import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getActiveShopId } from "@/lib/session";
import {
  getShopLedgerState,
  resolveCustomer,
  commitEntries,
  revertAndReplaceLastEntry,
  getCustomerBalance,
  getDailySummary,
  type LedgerActionItem,
} from "@/lib/khata";
import { parseHinglishCommand } from "@/lib/parser";

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
    const { transcript, selectedCustomerId, pendingActions } = body as {
      transcript?: string;
      selectedCustomerId?: string;
      pendingActions?: LedgerActionItem[];
    };

    // 1. Disambiguation Resolution Path
    if (selectedCustomerId && pendingActions && pendingActions.length > 0) {
      await commitEntries(shopId, selectedCustomerId, pendingActions);
      const cust = await db.orm.public.Customer.first({ id: selectedCustomerId });
      const bal = await getCustomerBalance(selectedCustomerId);
      const state = await getShopLedgerState(shopId);

      const custName = cust ? cust.name : "Customer";
      const tagText = cust?.tag ? ` (${cust.tag})` : "";
      const replyText = `Theek hai, ${custName}${tagText} ka hisab darj kiya. Ab total ₹${bal.balance.toLocaleString("en-IN")} baaki hai.`;

      return NextResponse.json({
        replyText,
        disambiguation: null,
        state,
      });
    }

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript is required." },
        { status: 400 },
      );
    }

    const parsed = parseHinglishCommand(transcript);

    // 2. Intent: Spoken Undo / Instant Correction ("nahi, 430")
    if (parsed.intent === "CORRECT_LAST") {
      const res = await revertAndReplaceLastEntry(shopId, parsed.newAmount);
      const state = await getShopLedgerState(shopId);

      if (res.status === "NO_ACTIVE_TRANSACTION_TO_UNDO") {
        return NextResponse.json({
          replyText: "Koyi aakhri entry nahi mili jise sudhara ja sake.",
          disambiguation: null,
          state,
        });
      }

      const replyText =
        parsed.newAmount !== undefined
          ? `Theek hai, badal kar ₹${parsed.newAmount.toLocaleString("en-IN")} kar diya gaya.`
          : "Theek hai, aakhri entry wapas le li gayi hai.";

      return NextResponse.json({
        replyText,
        disambiguation: null,
        state,
      });
    }

    // 3. Intent: Query Today ("aaj kitna udhaar gaya?")
    if (parsed.intent === "QUERY_TODAY") {
      const summary = await getDailySummary(shopId);
      const state = await getShopLedgerState(shopId);

      const replyText = `Aaj total ₹${summary.dailyUdhaar.toLocaleString("en-IN")} udhaar aur ₹${summary.dailyJama.toLocaleString("en-IN")} jama hua.`;

      return NextResponse.json({
        replyText,
        disambiguation: null,
        state,
      });
    }

    // 4. Intent: Query Customer ("Naresh bhai ka kitna baaki hai?")
    if (parsed.intent === "QUERY_CUSTOMER") {
      const resCust = await resolveCustomer(
        shopId,
        parsed.rawCustomerName || "unka",
        parsed.spokenTag,
      );

      const state = await getShopLedgerState(shopId);

      if (resCust.needsDisambiguation) {
        const replyText = `${parsed.rawCustomerName || "Ramesh"} ke ${resCust.candidates.length} khate hain. Kaunsa chunna hai?`;
        return NextResponse.json({
          replyText,
          disambiguation: {
            candidates: resCust.candidates,
            pendingQuery: true,
          },
          state,
        });
      }

      const targetCust = resCust.customer!;
      const bal = await getCustomerBalance(targetCust.id);

      let replyText = "";
      if (bal.balance > 0) {
        replyText = `${targetCust.name} ka total ₹${bal.balance.toLocaleString("en-IN")} baaki hai.`;
      } else if (bal.balance < 0) {
        replyText = `${targetCust.name} ka ₹${Math.abs(bal.balance).toLocaleString("en-IN")} jama (advance) hai.`;
      } else {
        replyText = `${targetCust.name} ka pura hisab chukta hai.`;
      }

      return NextResponse.json({
        replyText,
        disambiguation: null,
        state,
      });
    }

    // 5. Intent: Record Single or Compound Entry ("Ramesh ka 340 udhaar, kal 200 diya tha")
    const actionsToCommit = parsed.actions && parsed.actions.length > 0 ? parsed.actions : [];

    const resCust = await resolveCustomer(
      shopId,
      parsed.rawCustomerName || "unka",
      parsed.spokenTag,
    );

    const state = await getShopLedgerState(shopId);

    if (resCust.needsDisambiguation) {
      const candidateTags = resCust.candidates.map((c: { tag?: string | null; name: string }) => c.tag || c.name).join(" ya ");
      const replyText = `${parsed.rawCustomerName || "Customer"} ke 2 khate hain: ${candidateTags}?`;

      return NextResponse.json({
        replyText,
        disambiguation: {
          candidates: resCust.candidates,
          pendingActions: actionsToCommit,
        },
        state,
      });
    }

    const targetCustomer = resCust.customer!;
    await commitEntries(shopId, targetCustomer.id, actionsToCommit);
    const updatedBal = await getCustomerBalance(targetCustomer.id);
    const updatedState = await getShopLedgerState(shopId);

    let replyText = "";
    if (actionsToCommit.length === 1) {
      const act = actionsToCommit[0]!;
      const typeLabel = act.type === "UDHAAR" ? "udhaar" : "jama";
      replyText = `Theek hai, ${targetCustomer.name} ka ₹${act.amount.toLocaleString("en-IN")} ${typeLabel} likh diya. Ab total ₹${updatedBal.balance.toLocaleString("en-IN")} baaki hai.`;
    } else {
      replyText = `Theek hai, ${targetCustomer.name} ke ${actionsToCommit.length} hisab darj kiye. Ab total ₹${updatedBal.balance.toLocaleString("en-IN")} baaki hai.`;
    }

    return NextResponse.json({
      replyText,
      disambiguation: null,
      state: updatedState,
    });
  } catch (err: unknown) {
    console.error("Failed to execute khata command:", err);
    return NextResponse.json(
      { error: "Internal server error executing command." },
      { status: 500 },
    );
  }
}
