import { NextResponse } from "next/server";
import { getActiveShopId } from "@/lib/session";
import { getShopLedgerState } from "@/lib/khata";

export async function GET() {
  const shopId = await getActiveShopId();

  if (!shopId) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in or launch demo shop." },
      { status: 401 },
    );
  }

  try {
    const state = await getShopLedgerState(shopId);
    return NextResponse.json({ success: true, ...state });
  } catch (err: unknown) {
    console.error("Failed to load shop ledger state:", err);
    return NextResponse.json(
      { error: "Internal server error fetching khata state." },
      { status: 500 },
    );
  }
}
