"use server";

import { redirect } from "next/navigation";
import { db } from "../../prisma/db";
import { createSession, destroySession, hashPin, verifyPin } from "../../lib/session";

export interface AuthState {
  error?: string;
}

/**
 * Creates an isolated Demo Shop with pre-seeded duplicate customers
 * (e.g. Ramesh Sharma ji vs Ramesh Electrician) so disambiguation works on Turn 1.
 */
export async function startDemoShop(): Promise<never> {
  const shop = await db.orm.public.Shop.create({
    shopName: "Demo Kirana Counter",
    location: "Indiranagar, Bengaluru",
    isDemo: true,
    ownerPhone: null,
    pinHash: null,
  });

  const now = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Seed Customers
  const ramesh1 = await db.orm.public.Customer.create({
    shopId: shop.id,
    name: "Ramesh",
    tag: "Sharma ji",
    aliases: ["ramesh sharma", "sharma ji"],
    phone: "9876543201",
    reminderOptIn: true,
    lastTxAt: now,
  });

  const ramesh2 = await db.orm.public.Customer.create({
    shopId: shop.id,
    name: "Ramesh",
    tag: "Electrician",
    aliases: ["ramesh mistri", "electrician"],
    phone: "9876543202",
    reminderOptIn: true,
    lastTxAt: yesterday,
  });

  const naresh = await db.orm.public.Customer.create({
    shopId: shop.id,
    name: "Naresh bhai",
    tag: "Chowk",
    aliases: ["naresh", "naresh bhai chowk"],
    phone: "9876543203",
    reminderOptIn: false,
    lastTxAt: now,
  });

  const suresh = await db.orm.public.Customer.create({
    shopId: shop.id,
    name: "Suresh Kirana",
    tag: "Market",
    aliases: ["suresh bhai"],
    phone: "9876543204",
    reminderOptIn: true,
    lastTxAt: yesterday,
  });

  // Seed Initial Transactions
  await db.orm.public.Transaction.create({
    shopId: shop.id,
    customerId: ramesh1.id,
    type: "UDHAAR",
    amount: 340,
    notes: "2kg atta, tel",
    batchId: "demo_batch_1",
    transactionDate: now,
    isReverted: false,
  });

  await db.orm.public.Transaction.create({
    shopId: shop.id,
    customerId: naresh.id,
    type: "UDHAAR",
    amount: 1840,
    notes: "Dairy and dry rations",
    batchId: "demo_batch_2",
    transactionDate: now,
    isReverted: false,
  });

  await db.orm.public.Transaction.create({
    shopId: shop.id,
    customerId: ramesh2.id,
    type: "JAMA",
    amount: 200,
    notes: "Kal cash mila tha",
    batchId: "demo_batch_3",
    transactionDate: yesterday,
    isReverted: false,
  });

  await createSession(shop.id);
  redirect("/shoprr");
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
    redirect("/shoprr");
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
    redirect("/shoprr");
  }
}

/**
 * Clears session and redirects to entry page.
 */
export async function logoutShop(): Promise<never> {
  await destroySession();
  redirect("/");
}
