import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getActiveShopId } from "@/lib/session";
import { getCustomerBalance } from "@/lib/khata";

export async function POST(req: Request) {
  const shopId = await getActiveShopId();

  if (!shopId) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in or launch demo shop." },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const { customerId } = body as { customerId?: string };

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required." },
        { status: 400 },
      );
    }

    const customer = await db.orm.public.Customer.first({ id: customerId });

    if (!customer || customer.shopId !== shopId) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 },
      );
    }

    // Mandatory PS2 Compliance Guardrail:
    // Reminders ONLY permitted if customer has opted in.
    if (!customer.reminderOptIn) {
      return NextResponse.json(
        {
          error: "Customer has not opted in for reminders. Respecting privacy (PS2 compliance).",
          optInRequired: true,
        },
        { status: 403 },
      );
    }

    const shop = await db.orm.public.Shop.first({ id: shopId });
    const { balance } = await getCustomerBalance(customer.id);
    const shopName = shop?.shopName || "Kirana Store";

    let message = "";
    if (balance <= 0) {
      message = `Namaste ${customer.name} ji, aapka kirana hisab pura chukta hai. Khareedari ke liye dhanyawad! - ${shopName}`;
    } else {
      // Polite, zero-pressure reminder language
      message = `Namaste ${customer.name} ji, aapka kirana khata hisab ₹${balance.toLocaleString("en-IN")} hai. Jab suvidha ho tab jama karwa dein. Dhanyawad - ${shopName}`;
    }

    return NextResponse.json({
      success: true,
      message,
      balance,
      customer: {
        id: customer.id,
        name: customer.name,
        tag: customer.tag,
        phone: customer.phone,
        reminderOptIn: customer.reminderOptIn,
      },
    });
  } catch (err: unknown) {
    console.error("Failed to generate payment reminder:", err);
    return NextResponse.json(
      { error: "Internal server error generating reminder." },
      { status: 500 },
    );
  }
}
