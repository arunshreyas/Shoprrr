import { db } from "./db.ts";

let pendingSeed: Promise<void> | undefined;

async function runSeed(): Promise<void> {
  try {
    const existing = await db.orm.public.Shop.first();
    if (!existing) {
      await db.orm.public.Shop.create({
        shopName: "Kirana Demo Store",
        isDemo: true,
      });
    }
  } catch {
    // Database may not be initialized yet
  }
}

export function seed(): Promise<void> {
  pendingSeed ??= runSeed().catch((error: unknown) => {
    pendingSeed = undefined;
    throw error;
  });
  return pendingSeed;
}

