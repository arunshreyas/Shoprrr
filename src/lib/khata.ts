import { and } from "@prisma/orm-postgres/orm-client";
import { db } from "../prisma/db";

export type TxType = "UDHAAR" | "JAMA";

export interface CompoundEntryItem {
  type: TxType;
  amount: number;
  transactionDate?: Date;
  notes?: string;
}

/**
 * 1. Customer Name Resolution & Disambiguation
 * Handles pronoun resolution ("unka", "uska") via lastTxAt,
 * case-insensitive name lookup, and phonetic STT aliases matching.
 */
export async function resolveCustomer(
  shopId: string,
  spokenNameOrPronoun: string,
  spokenTag?: string,
) {
  const normalized = spokenNameOrPronoun.trim().toLowerCase();
  const isPronoun = ["unka", "uska", "unhone", "unko", "vo"].includes(normalized);

  // A) Pronoun resolution: Return the active customer from the most recent transaction
  if (isPronoun) {
    const activeCustomer = await db.orm.public.Customer
      .where((c) => c.shopId.eq(shopId))
      .orderBy((c) => c.lastTxAt.desc({ nulls: "last" }))
      .first();

    return {
      status: activeCustomer ? ("RESOLVED" as const) : ("NOT_FOUND" as const),
      customer: activeCustomer,
      candidates: activeCustomer ? [activeCustomer] : [],
    };
  }

  // B) Query shop customers (uses customer_shop_name_lower index)
  const customers = await db.orm.public.Customer
    .where((c) => c.shopId.eq(shopId))
    .all();

  // Match by exact/case-insensitive name, tag, or phonetic alias
  const matches = customers.filter((c) => {
    const nameMatch = c.name.toLowerCase() === normalized;
    const aliasMatch = c.aliases.some((a) => a.toLowerCase() === normalized);
    return nameMatch || aliasMatch;
  });

  if (matches.length === 0) {
    return {
      status: "NOT_FOUND" as const,
      customer: null,
      candidates: [],
    };
  }

  // If duplicate customers exist, disambiguate by tag (e.g. "Sharma ji" vs "Electrician")
  if (matches.length > 1) {
    if (spokenTag) {
      const tagNormalized = spokenTag.trim().toLowerCase();
      const disambiguated = matches.find(
        (c) => c.tag && c.tag.toLowerCase() === tagNormalized,
      );
      if (disambiguated) {
        return {
          status: "RESOLVED" as const,
          customer: disambiguated,
          candidates: [disambiguated],
        };
      }
    }

    return {
      status: "DISAMBIGUATION_REQUIRED" as const,
      customer: null,
      candidates: matches, // Present candidates to voice synthesizer to ask merchant
    };
  }

  return {
    status: "RESOLVED" as const,
    customer: matches[0]!,
    candidates: matches,
  };
}

/**
 * 2. Compound Utterance Commit
 * Atomically commits multi-entry utterances (e.g., "Ramesh ka 340 udhaar, kal 200 diya tha")
 * linked by a shared batchId, and updates customer's lastTxAt.
 */
export async function commitCompoundUtterance(
  shopId: string,
  customerId: string,
  entries: CompoundEntryItem[],
) {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();

  return await db.transaction(async (tx) => {
    const createdTransactions = [];

    for (const entry of entries) {
      const created = await tx.orm.public.Transaction.create({
        shopId,
        customerId,
        type: entry.type,
        amount: Math.round(entry.amount),
        notes: entry.notes ?? null,
        batchId,
        transactionDate: entry.transactionDate ?? now,
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
 * 3. Spoken Instant Undo / Correction ("nahi, 430")
 * Finds the exact most recently spoken entry using createdAt (even if transactionDate was backdated),
 * marks it isReverted = true, and records the new replacement.
 */
export async function undoOrCorrectLastSpoken(
  shopId: string,
  newAmount?: number,
  customerId?: string,
) {
  // Find the exact most recently created active transaction in this shop
  let query = db.orm.public.Transaction.where({ shopId, isReverted: false });
  if (customerId) {
    query = query.where({ customerId });
  }

  const lastTx = await query.orderBy((t) => t.createdAt.desc()).first();

  if (!lastTx) {
    return { status: "NO_ACTIVE_TRANSACTION_TO_UNDO" as const };
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
 * 4. Fast Customer Balance Calculation: SUM(UDHAAR) - SUM(JAMA)
 * Fast execution using index @@index([customerId, isReverted]).
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
 * 5. Daily Ledger Summary ("Aaj kitna udhaar gaya?")
 * Fast execution using index @@index([shopId, transactionDate]).
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
