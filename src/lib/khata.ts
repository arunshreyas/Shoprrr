import { and } from "@prisma/orm-postgres/orm-client";
import { db } from "../prisma/db";

export type TxType = "UDHAAR" | "JAMA";

export interface LedgerActionItem {
  type: TxType;
  amount: number;
  transactionDate?: Date;
  notes?: string;
}

export interface CustomerWithBalance {
  id: string;
  name: string;
  displayName: string;
  tag: string | null;
  aliases: readonly string[];
  phone: string | null;
  reminderOptIn: boolean;
  lastTxAt: Date | null;
  balance: number; // positive = customer owes money (UDHAAR > JAMA), negative = advance
  udhaarTotal: number;
  jamaTotal: number;
  txCount: number;
  subtitle: string;
}

export interface ShopLedgerState {
  shop: {
    id: string;
    shopName: string;
    location: string | null;
    ownerPhone: string | null;
    isDemo: boolean;
  } | null;
  customers: CustomerWithBalance[];
  transactions: Array<{
    id: string;
    shopId: string;
    customerId: string;
    customerName: string;
    customerTag: string | null;
    type: TxType;
    amount: number;
    notes: string | null;
    batchId: string | null;
    transactionDate: Date;
    isReverted: boolean;
    replacesTxId: string | null;
    createdAt: string | Date;
  }>;
  today: {
    udhaar: number;
    jama: number;
    count: number;
  };
  totalPendingBalance: number;
}

/**
 * 1. getShopLedgerState(shopId)
 * Returns active transactions (isReverted: false, ordered newest first),
 * today's UDHAAR and JAMA totals, and every customer's net pending balance (SUM(UDHAAR) - SUM(JAMA)).
 */
export async function getShopLedgerState(shopId: string): Promise<ShopLedgerState> {
  const shop = await db.orm.public.Shop.first({ id: shopId });
  const customers = await db.orm.public.Customer.where({ shopId }).all();
  const transactions = await db.orm.public.Transaction
    .where({ shopId, isReverted: false })
    .orderBy((t) => t.createdAt.desc())
    .all();

  // Create customer lookup map
  const customerMap = new Map<string, (typeof customers)[0]>();
  for (const c of customers) {
    customerMap.set(c.id, c);
  }

  // Calculate today's boundaries (local / server calendar day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  let todayUdhaar = 0;
  let todayJama = 0;
  let todayCount = 0;

  // Track customer totals
  const custStats = new Map<
    string,
    { udhaar: number; jama: number; count: number }
  >();

  for (const c of customers) {
    custStats.set(c.id, { udhaar: 0, jama: 0, count: 0 });
  }

  const enrichedTxs = transactions.map((t) => {
    const cust = customerMap.get(t.customerId);
    const isToday =
      t.transactionDate >= todayStart && t.transactionDate <= todayEnd;

    if (isToday) {
      todayCount += 1;
      if (t.type === "UDHAAR") {
        todayUdhaar += t.amount;
      } else {
        todayJama += t.amount;
      }
    }

    const stat = custStats.get(t.customerId) || { udhaar: 0, jama: 0, count: 0 };
    if (t.type === "UDHAAR") {
      stat.udhaar += t.amount;
    } else {
      stat.jama += t.amount;
    }
    stat.count += 1;
    custStats.set(t.customerId, stat);

    return {
      id: t.id,
      shopId: t.shopId,
      customerId: t.customerId,
      customerName: cust ? cust.name : "Unknown",
      customerTag: cust?.tag ?? null,
      type: t.type as TxType,
      amount: t.amount,
      notes: t.notes,
      batchId: t.batchId,
      transactionDate: t.transactionDate,
      isReverted: t.isReverted,
      replacesTxId: t.replacesTxId,
      createdAt: t.createdAt,
    };
  });

  let totalPendingBalance = 0;
  const customerBalances: CustomerWithBalance[] = customers.map((c) => {
    const stat = custStats.get(c.id) || { udhaar: 0, jama: 0, count: 0 };
    const netBalance = stat.udhaar - stat.jama;
    totalPendingBalance += netBalance;

    const latestTx = transactions.find((t) => t.customerId === c.id);
    let subtitle = "New account • 0 entries";

    if (netBalance === 0 && stat.count > 0) {
      subtitle = "Settled • ₹0 pending";
    } else if (latestTx) {
      const txDate = new Date(latestTx.transactionDate);
      const isTodayTx = txDate >= todayStart && txDate <= todayEnd;
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const isYesterdayTx = txDate >= yesterdayStart && txDate < todayStart;

      const typeLabel = latestTx.type === "UDHAAR" ? "udhaar" : "jama";
      if (isTodayTx) {
        subtitle = `Last ${typeLabel}: Today • ${stat.count} entries`;
      } else if (isYesterdayTx) {
        subtitle = `Last ${typeLabel}: Yesterday (Kal) • ${stat.count} entries`;
      } else {
        const diffDays = Math.max(
          2,
          Math.floor((todayStart.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        subtitle = `Last ${typeLabel}: ${diffDays} days ago • ${stat.count} entries`;
      }
    }

    return {
      id: c.id,
      name: c.name,
      displayName: c.tag ? `${c.name} (${c.tag})` : c.name,
      tag: c.tag,
      aliases: c.aliases,
      phone: c.phone,
      reminderOptIn: c.reminderOptIn,
      lastTxAt: c.lastTxAt,
      balance: netBalance,
      udhaarTotal: stat.udhaar,
      jamaTotal: stat.jama,
      txCount: stat.count,
      subtitle,
    };
  });

  return {
    shop: shop
      ? {
          id: shop.id,
          shopName: shop.shopName,
          location: shop.location,
          ownerPhone: shop.ownerPhone,
          isDemo: shop.isDemo,
        }
      : null,
    customers: customerBalances,
    transactions: enrichedTxs,
    today: {
      udhaar: todayUdhaar,
      jama: todayJama,
      count: todayCount,
    },
    totalPendingBalance,
  };
}

/**
 * 2. resolveCustomer(shopId, rawName)
 * Case-insensitive match on Customer.name (also checking aliases).
 * Resolves pronouns ("unka", "uska", etc.) using lastTxAt.
 * If 0 matches, auto-creates the customer and returns it.
 * If 2+ match, returns { needsDisambiguation: true, candidates }.
 */
export async function resolveCustomer(
  shopId: string,
  rawName: string,
  spokenTag?: string,
) {
  const normalized = rawName.trim().toLowerCase();
  const isPronoun = ["unka", "uska", "unhone", "unko", "vo", "inka", "iska"].includes(
    normalized,
  );

  // A) Pronoun resolution: Return the active customer from the most recent transaction
  if (isPronoun) {
    const activeCustomer = await db.orm.public.Customer
      .where((c) => c.shopId.eq(shopId))
      .orderBy((c) => c.lastTxAt.desc({ nulls: "last" }))
      .first();

    if (activeCustomer) {
      return {
        needsDisambiguation: false,
        customer: activeCustomer,
        candidates: [activeCustomer],
      };
    }
  }

  // B) Query shop customers
  const customers = await db.orm.public.Customer
    .where((c) => c.shopId.eq(shopId))
    .all();

  // Match by exact/case-insensitive name, tag, or phonetic alias
  const matches = customers.filter((c) => {
    const nameMatch = c.name.toLowerCase() === normalized;
    const aliasMatch = c.aliases.some((a) => a.toLowerCase() === normalized);
    return nameMatch || aliasMatch;
  });

  // If 0 matches: Auto-create the customer and return it
  if (matches.length === 0) {
    const capitalizedName =
      rawName.trim().charAt(0).toUpperCase() + rawName.trim().slice(1);
    const created = await db.orm.public.Customer.create({
      shopId,
      name: capitalizedName,
      tag: spokenTag?.trim() || null,
      aliases: [normalized],
      reminderOptIn: false,
      lastTxAt: new Date(),
    });

    return {
      needsDisambiguation: false,
      customer: created,
      candidates: [created],
    };
  }

  // If duplicate customers exist, check if spokenTag resolves it
  if (matches.length > 1) {
    if (spokenTag) {
      const tagNormalized = spokenTag.trim().toLowerCase();
      const disambiguated = matches.find(
        (c) => c.tag && c.tag.toLowerCase() === tagNormalized,
      );
      if (disambiguated) {
        return {
          needsDisambiguation: false,
          customer: disambiguated,
          candidates: [disambiguated],
        };
      }
    }

    // Still ambiguous: return needsDisambiguation: true
    return {
      needsDisambiguation: true,
      customer: null,
      candidates: matches,
    };
  }

  return {
    needsDisambiguation: false,
    customer: matches[0]!,
    candidates: matches,
  };
}

/**
 * 3. commitEntries(shopId, customerId, actions[])
 * Inserts single or compound entries (UDHAAR | JAMA) under a shared batchId,
 * respecting backdated transactionDate values and updating Customer.lastTxAt.
 */
export async function commitEntries(
  shopId: string,
  customerId: string,
  actions: LedgerActionItem[],
) {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();

  return await db.transaction(async (tx) => {
    const createdTransactions = [];

    for (const action of actions) {
      const created = await tx.orm.public.Transaction.create({
        shopId,
        customerId,
        type: action.type,
        amount: Math.round(action.amount),
        notes: action.notes ?? null,
        batchId,
        transactionDate: action.transactionDate ?? now,
        isReverted: false,
      });
      createdTransactions.push(created);
    }

    // Update customer lastTxAt for fast pronoun resolution in rush hours
    await tx.orm.public.Customer
      .where({ id: customerId })
      .updateAndCount({ lastTxAt: now });

    return {
      batchId,
      transactions: createdTransactions,
    };
  });
}

/**
 * 4. revertAndReplaceLastEntry(shopId, newAmount)
 * Finds the most recently created (createdAt desc) non-reverted transaction for shopId,
 * sets isReverted: true, and inserts a replacement transaction with the same customerId,
 * type, transactionDate, and replacesTxId.
 */
export async function revertAndReplaceLastEntry(
  shopId: string,
  newAmount?: number,
  customerId?: string,
) {
  let query = db.orm.public.Transaction.where({ shopId, isReverted: false });
  if (customerId) {
    query = query.where({ customerId });
  }

  const lastTx = await query.orderBy((t) => t.createdAt.desc()).first();

  if (!lastTx) {
    return {
      status: "NO_ACTIVE_TRANSACTION_TO_UNDO" as const,
      revertedTx: null,
      replacementTx: null,
    };
  }

  return await db.transaction(async (tx) => {
    // Revert the original entry
    await tx.orm.public.Transaction
      .where({ id: lastTx.id })
      .updateAndCount({ isReverted: true });

    let replacement = null;

    // If new amount provided ("nahi, 430"), create the replacement entry
    if (newAmount !== undefined) {
      replacement = await tx.orm.public.Transaction.create({
        shopId: lastTx.shopId,
        customerId: lastTx.customerId,
        type: lastTx.type,
        amount: Math.round(newAmount),
        notes: lastTx.notes,
        batchId: lastTx.batchId,
        transactionDate: lastTx.transactionDate, // Preserves original relative/backdated business date
        isReverted: false,
        replacesTxId: lastTx.id,
      });
    }

    // Touch customer lastTxAt
    await tx.orm.public.Customer
      .where({ id: lastTx.customerId })
      .updateAndCount({ lastTxAt: new Date() });

    return {
      status: "SUCCESS" as const,
      revertedTx: lastTx,
      replacementTx: replacement,
    };
  });
}

/**
 * Fast Customer Balance Calculation: SUM(UDHAAR) - SUM(JAMA)
 */
export async function getCustomerBalance(customerId: string) {
  const activeTxs = await db.orm.public.Transaction
    .where({ customerId, isReverted: false })
    .select("type", "amount")
    .all();

  let udhaar = 0;
  let jama = 0;

  for (const tx of activeTxs) {
    if (tx.type === "UDHAAR") {
      udhaar += tx.amount;
    } else if (tx.type === "JAMA") {
      jama += tx.amount;
    }
  }

  return {
    udhaar,
    jama,
    balance: udhaar - jama, // Positive = customer owes money; Negative = advance payment
  };
}

/**
 * Daily Ledger Summary ("Aaj kitna udhaar gaya?")
 */
export async function getDailySummary(shopId: string, targetDate = new Date()) {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dailyTxs = await db.orm.public.Transaction
    .where({ shopId, isReverted: false })
    .where((t) =>
      and(
        t.transactionDate.gte(startOfDay),
        t.transactionDate.lte(endOfDay),
      ),
    )
    .select("type", "amount")
    .all();

  let dailyUdhaar = 0;
  let dailyJama = 0;

  for (const tx of dailyTxs) {
    if (tx.type === "UDHAAR") {
      dailyUdhaar += tx.amount;
    } else if (tx.type === "JAMA") {
      dailyJama += tx.amount;
    }
  }

  return {
    date: startOfDay.toISOString().split("T")[0],
    dailyUdhaar,
    dailyJama,
    count: dailyTxs.length,
  };
}
