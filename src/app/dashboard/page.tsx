import { getActiveShopId, createSession } from "@/lib/session";
import { getShopLedgerState } from "@/lib/khata";
import { db } from "@/prisma/db";
import { seedDemoShopData } from "@/app/actions/auth";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  let shopId = await getActiveShopId();

  if (!shopId) {
    // If user accesses /dashboard directly without an active session cookie,
    // auto-provision the isolated demo shop so they get the full live counter immediately!
    const shop = await db.orm.public.Shop.create({
      shopName: "Gupta Kirana Store (Demo)",
      location: "Indiranagar, Bengaluru",
      isDemo: true,
      ownerPhone: null,
      pinHash: null,
    });
    await seedDemoShopData(shop.id);
    await createSession(shop.id);
    shopId = shop.id;
  }

  const initialData = await getShopLedgerState(shopId);

  return <DashboardClient initialData={initialData} />;
}
