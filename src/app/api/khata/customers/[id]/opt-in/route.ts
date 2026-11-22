import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { getActiveShopId } from "@/lib/session";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const shopId = await getActiveShopId();

  if (!shopId) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in or launch demo shop." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const customer = await db.orm.public.Customer.first({ id });

    if (!customer || customer.shopId !== shopId) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 },
      );
    }

    let nextOptIn = !customer.reminderOptIn;
    try {
      const body = await req.json();
      if (typeof body.reminderOptIn === "boolean") {
        nextOptIn = body.reminderOptIn;
      }
    } catch {
      // Body not provided or not JSON, toggle default
    }

    await db.orm.public.Customer
      .where({ id: customer.id })
      .updateAndCount({ reminderOptIn: nextOptIn });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      reminderOptIn: nextOptIn,
    });
  } catch (err: unknown) {
    console.error("Failed to update customer reminderOptIn:", err);
    return NextResponse.json(
      { error: "Internal server error updating reminder preference." },
      { status: 500 },
    );
  }
}
