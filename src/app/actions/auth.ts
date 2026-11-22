"use server";

import { redirect } from "next/navigation";
import { db } from "../../prisma/db";
import { createSession, destroySession, hashPin, verifyPin } from "../../lib/session";

export interface AuthState {
  error?: string;
}

/**
 * Seeds a realistic Kirana counter with 18 customers and real transactions:
 * Total Market Baaki: ₹14,820
 * Active Customers: 18
 * Today's Udhaar: ₹1,450
 * Today's Jama: ₹800
 * Opted-in: 12 / 18
 */
export async function seedDemoShopData(shopId: string) {
  const now = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // 18 Realistic Kirana Customers
  const customersData = [
    { name: "Ramesh", tag: "Sharma ji", aliases: ["ramesh sharma", "sharma ji"], phone: "9876543201", reminderOptIn: true, lastTxAt: now },
    { name: "Naresh bhai", tag: "Chowk", aliases: ["naresh", "naresh bhai chowk"], phone: "9876543202", reminderOptIn: false, lastTxAt: now },
    { name: "Ramesh", tag: "Electrician", aliases: ["ramesh mistri", "electrician"], phone: "9876543203", reminderOptIn: true, lastTxAt: yesterday },
    { name: "Suresh Kirana", tag: "Market", aliases: ["suresh bhai"], phone: "9876543204", reminderOptIn: true, lastTxAt: twoDaysAgo },
    { name: "Dinesh Kumar", tag: "Station Road", aliases: ["dinesh"], phone: "9876543205", reminderOptIn: true, lastTxAt: now },
    { name: "Pooja Store", tag: "Main Bazaar", aliases: ["pooja"], phone: "9876543206", reminderOptIn: true, lastTxAt: now },
    { name: "Vikram Singh", tag: "Gali No. 3", aliases: ["vikram"], phone: "9876543207", reminderOptIn: false, lastTxAt: twoDaysAgo },
    { name: "Sunita Devi", tag: "Teacher ji", aliases: ["sunita"], phone: "9876543208", reminderOptIn: true, lastTxAt: yesterday },
    { name: "Amit Verma", tag: "Hardware", aliases: ["amit"], phone: "9876543209", reminderOptIn: true, lastTxAt: threeDaysAgo },
    { name: "Rajesh Bhai", tag: "Auto", aliases: ["rajesh"], phone: "9876543210", reminderOptIn: false, lastTxAt: yesterday },
    { name: "Kavita Ben", tag: "Tailor", aliases: ["kavita"], phone: "9876543211", reminderOptIn: true, lastTxAt: fourDaysAgo },
    { name: "Manoj Dairy", tag: "Corner", aliases: ["manoj"], phone: "9876543212", reminderOptIn: true, lastTxAt: yesterday },
    { name: "Deepak Gupta", tag: "Medical", aliases: ["deepak"], phone: "9876543213", reminderOptIn: true, lastTxAt: twoDaysAgo },
    { name: "Sanjay Kumar", tag: "Painter", aliases: ["sanjay"], phone: "9876543214", reminderOptIn: false, lastTxAt: threeDaysAgo },
    { name: "Anita Sharma", tag: "Civil Lines", aliases: ["anita"], phone: "9876543215", reminderOptIn: true, lastTxAt: yesterday },
    { name: "Kamlesh Carpenter", tag: "Wood Works", aliases: ["kamlesh"], phone: "9876543216", reminderOptIn: true, lastTxAt: fourDaysAgo },
    { name: "Mohan Lal", tag: "Sweet Shop", aliases: ["mohan"], phone: "9876543217", reminderOptIn: false, lastTxAt: yesterday },
    { name: "Prakash Cloth", tag: "Bazaar", aliases: ["prakash"], phone: "9876543218", reminderOptIn: false, lastTxAt: threeDaysAgo },
  ];

  const createdCustomers = [];
  for (const c of customersData) {
    const cust = await db.orm.public.Customer.create({
      shopId,
      name: c.name,
      tag: c.tag,
      aliases: c.aliases,
      phone: c.phone,
      reminderOptIn: c.reminderOptIn,
      lastTxAt: c.lastTxAt,
    });
    createdCustomers.push(cust);
  }

  // Initial Transactions matching exact dashboard totals:
  // Total Market Baaki: ₹14,820
  // Today Udhaar: ₹1,450 (340 + 500 + 610)
  // Today Jama: ₹800
  // Opted-in: 12 / 18
  const txsToCreate = [
    // Ramesh (Sharma ji) -> 2480 (2140 earlier + 340 today)
    { customerId: createdCustomers[0]!.id, type: "UDHAAR" as const, amount: 2140, notes: "Previous month carryforward", txDate: threeDaysAgo },
    { customerId: createdCustomers[0]!.id, type: "UDHAAR" as const, amount: 340, notes: "2kg atta, tel", txDate: now },

    // Naresh bhai -> 1840 (1340 earlier + 500 today)
    { customerId: createdCustomers[1]!.id, type: "UDHAAR" as const, amount: 1340, notes: "Ration dry goods", txDate: fourDaysAgo },
    { customerId: createdCustomers[1]!.id, type: "UDHAAR" as const, amount: 500, notes: "Dairy & spices", txDate: now },

    // Ramesh (Electrician) -> 650 (850 earlier - 200 jama yesterday)
    { customerId: createdCustomers[2]!.id, type: "UDHAAR" as const, amount: 850, notes: "Tools & wires", txDate: threeDaysAgo },
    { customerId: createdCustomers[2]!.id, type: "JAMA" as const, amount: 200, notes: "Cash payment", txDate: yesterday },

    // Suresh Kirana -> 0 Settled (650 udhaar - 650 jama)
    { customerId: createdCustomers[3]!.id, type: "UDHAAR" as const, amount: 650, notes: "Oil tins", txDate: fourDaysAgo },
    { customerId: createdCustomers[3]!.id, type: "JAMA" as const, amount: 650, notes: "UPI full settlement", txDate: twoDaysAgo },

    // Dinesh Kumar -> 1200 (590 earlier + 610 today)
    { customerId: createdCustomers[4]!.id, type: "UDHAAR" as const, amount: 590, notes: "Pulses & rice", txDate: threeDaysAgo },
    { customerId: createdCustomers[4]!.id, type: "UDHAAR" as const, amount: 610, notes: "Ration items", txDate: now },

    // Pooja Store -> 1950 (2750 earlier - 800 jama today)
    { customerId: createdCustomers[5]!.id, type: "UDHAAR" as const, amount: 2750, notes: "Wholesale sugar sacks", txDate: fiveDaysAgo },
    { customerId: createdCustomers[5]!.id, type: "JAMA" as const, amount: 800, notes: "Cash received", txDate: now },

    // Vikram Singh -> 850
    { customerId: createdCustomers[6]!.id, type: "UDHAAR" as const, amount: 850, notes: "Biscuits & tea packs", txDate: twoDaysAgo },

    // Sunita Devi -> 1420
    { customerId: createdCustomers[7]!.id, type: "UDHAAR" as const, amount: 1420, notes: "Monthly grocery balance", txDate: yesterday },

    // Amit Verma -> 780
    { customerId: createdCustomers[8]!.id, type: "UDHAAR" as const, amount: 780, notes: "Hardware store credit", txDate: threeDaysAgo },

    // Rajesh Bhai -> 1150
    { customerId: createdCustomers[9]!.id, type: "UDHAAR" as const, amount: 1150, notes: "Provisions & flour", txDate: yesterday },

    // Kavita Ben -> 620
    { customerId: createdCustomers[10]!.id, type: "UDHAAR" as const, amount: 620, notes: "Spices and oil", txDate: fourDaysAgo },

    // Manoj Dairy -> 1340
    { customerId: createdCustomers[11]!.id, type: "UDHAAR" as const, amount: 1340, notes: "Butter & cheese packs", txDate: yesterday },

    // Deepak Gupta -> 580
    { customerId: createdCustomers[12]!.id, type: "UDHAAR" as const, amount: 580, notes: "Soaps & cleaning", txDate: twoDaysAgo },

    // Sanjay Kumar -> 920
    { customerId: createdCustomers[13]!.id, type: "UDHAAR" as const, amount: 920, notes: "Daily needs", txDate: threeDaysAgo },

    // Anita Sharma -> 410
    { customerId: createdCustomers[14]!.id, type: "UDHAAR" as const, amount: 410, notes: "Tea & bakery", txDate: yesterday },

    // Kamlesh Carpenter -> 380
    { customerId: createdCustomers[15]!.id, type: "UDHAAR" as const, amount: 380, notes: "Snacks", txDate: fourDaysAgo },

    // Mohan Lal -> 0 Settled (500 udhaar - 500 jama)
    { customerId: createdCustomers[16]!.id, type: "UDHAAR" as const, amount: 500, notes: "Milk crates", txDate: threeDaysAgo },
    { customerId: createdCustomers[16]!.id, type: "JAMA" as const, amount: 500, notes: "Daily evening settlement", txDate: yesterday },

    // Prakash Cloth -> 0 Settled (700 udhaar - 700 jama)
    { customerId: createdCustomers[17]!.id, type: "UDHAAR" as const, amount: 700, notes: "Flour & sugar", txDate: fourDaysAgo },
    { customerId: createdCustomers[17]!.id, type: "JAMA" as const, amount: 700, notes: "Cash settlement", txDate: threeDaysAgo },
  ];

  for (let i = 0; i < txsToCreate.length; i++) {
    const tx = txsToCreate[i]!;
    await db.orm.public.Transaction.create({
      shopId,
      customerId: tx.customerId,
      type: tx.type,
      amount: tx.amount,
      notes: tx.notes,
      batchId: `seed_batch_${i + 1}`,
      transactionDate: tx.txDate,
      isReverted: false,
    });
  }
}

/**
 * Creates an isolated Demo Shop with pre-seeded duplicate customers
 * (e.g. Ramesh Sharma ji vs Ramesh Electrician) so disambiguation works on Turn 1.
 */
export async function startDemoShop(): Promise<never> {
  const shop = await db.orm.public.Shop.create({
    shopName: "Gupta Kirana Store (Demo)",
    location: "Indiranagar, Bengaluru",
    isDemo: true,
    ownerPhone: null,
    pinHash: null,
  });

  await seedDemoShopData(shop.id);
  await createSession(shop.id);
  redirect("/dashboard");
}

/**
 * Handles Open Counter (Existing) or Create Counter (New).
 */
export async function openOrCreateShop(
  _prevState: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const mode = formData.get("mode")?.toString() || "new";
  const mobile = formData.get("mobile")?.toString().trim() || "";
  const pin = formData.get("pin")?.toString().trim() || "";
  const shopName = formData.get("shopName")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim() || "";

  if (!/^\d{10}$/.test(mobile)) {
    return { error: "Please enter a valid 10-digit mobile number." };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { error: "Please enter a valid 4-digit numeric PIN." };
  }

  if (mode === "existing") {
    const shop = await db.orm.public.Shop.where({ ownerPhone: mobile }).first();

    if (!shop) {
      return { error: "No shop found with this mobile number. Please select 'New Shop' to register." };
    }

    if (shop.pinHash && !verifyPin(pin, shop.pinHash)) {
      return { error: "Incorrect 4-digit PIN. Please try again." };
    }

    await createSession(shop.id);
    redirect("/dashboard");
  } else {
    // Mode === "new"
    if (!shopName) {
      return { error: "Shop Name is required." };
    }

    const existing = await db.orm.public.Shop.where({ ownerPhone: mobile }).first();
    if (existing) {
      return { error: "A shop with this mobile number already exists. Please choose 'Existing Shop'." };
    }

    const pinHash = hashPin(pin);
    const shop = await db.orm.public.Shop.create({
      shopName,
      location: location || null,
      ownerPhone: mobile,
      pinHash,
      isDemo: false,
    });

    await createSession(shop.id);
    redirect("/dashboard");
  }
}

/**
 * Clears session and redirects to entry page.
 */
export async function logoutShop(): Promise<never> {
  await destroySession();
  redirect("/");
}
