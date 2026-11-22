"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { detectWakeWord } from "@/lib/parser";
import type { ShopLedgerState, CustomerWithBalance } from "@/lib/khata";

interface DisambiguationData {
  candidates: Array<{ id: string; name: string; tag: string | null; phone: string | null }>;
  pendingActions?: Array<{ type: "UDHAAR" | "JAMA"; amount: number; transactionDate?: string; notes?: string }>;
}

export default function DashboardClient({
  initialData,
}: {
  initialData: ShopLedgerState;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"balances" | "recent">("balances");
  const [searchQuery, setSearchQuery] = useState("");
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [remindersSent, setRemindersSent] = useState<Record<string, boolean>>({});
  const [reminderModalMessage, setReminderModalMessage] = useState<string | null>(null);

  // Live Ledger State initialized with server data
  const [shopName, setShopName] = useState(initialData.shop?.shopName || "Kirana Counter");
  const [totalMarketBaaki, setTotalMarketBaaki] = useState(initialData.totalPendingBalance || 0);
  const [todayUdhaar, setTodayUdhaar] = useState(initialData.today?.udhaar || 0);
  const [todayJama, setTodayJama] = useState(initialData.today?.jama || 0);
  const [customers, setCustomers] = useState<CustomerWithBalance[]>(initialData.customers || []);
  const [recentEntries, setRecentEntries] = useState(initialData.transactions || []);

  // Voice Interaction Preview in Dock
  const [voiceDockCaption, setVoiceDockCaption] = useState<string>(
    "Say 'Shoppr, Naresh ko 200 debt hai' anytime",
  );
  const [voiceDockReply, setVoiceDockReply] = useState<string>(
    "Sub-2s Alexa-style spoken ledger confirmation",
  );
  const [disambiguation, setDisambiguation] = useState<DisambiguationData | null>(null);

  const recognitionRef = useRef<any>(null);

  // Text-To-Speech
  const speakVoiceReply = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Send Command to Ledger Engine
  const executeVoiceCommand = async (
    transcript: string,
    disambiguationResolve?: { customerId: string; pendingActions: any[] },
  ) => {
    setIsVoiceProcessing(true);
    setVoiceDockCaption(`Heard: "${transcript}"`);

    try {
      const payload: any = disambiguationResolve
        ? {
            selectedCustomerId: disambiguationResolve.customerId,
            pendingActions: disambiguationResolve.pendingActions,
          }
        : { transcript };

      const res = await fetch("/api/khata/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.replyText) {
        setVoiceDockReply(data.replyText);
        speakVoiceReply(data.replyText);
      }

      if (data.disambiguation) {
        setDisambiguation(data.disambiguation);
      } else {
        setDisambiguation(null);
      }

      if (data.state) {
        setTotalMarketBaaki(data.state.totalPendingBalance || 0);
        setTodayUdhaar(data.state.today?.udhaar || 0);
        setTodayJama(data.state.today?.jama || 0);
        if (data.state.customers) {
          setCustomers(data.state.customers);
        }
        if (data.state.transactions) {
          setRecentEntries(data.state.transactions);
        }
      }
    } catch (err) {
      console.error("Failed to execute voice command:", err);
      setVoiceDockReply("Kuch gadbad ho gayi. Kripya dubara bolein.");
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  // Continuous Hands-Free Alexa-Style Wake Word Trigger Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "hi-IN";

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      if (!transcript) return;

      const trimmed = transcript.trim();
      const { hasWakeWord } = detectWakeWord(trimmed);

      // In Hands-Free mode, trigger when wake word is detected ("Shoppr, ...", "Shoprr, ...")
      if (hasWakeWord || !isHandsFree) {
        executeVoiceCommand(trimmed);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isHandsFree) {
        try {
          recognition.start();
        } catch {
          // Ignore
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Hands-free speech error:", e.error);
    };

    recognitionRef.current = recognition;

    if (isHandsFree) {
      try {
        recognition.start();
      } catch {
        // Ignore
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, [isHandsFree]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        (c.tag && c.tag.toLowerCase().includes(q)),
    );
  }, [searchQuery, customers]);

  // Opt-in toggle via PATCH /api/khata/customers/[id]/opt-in
  const handleToggleOptIn = async (customerId: string) => {
    try {
      const res = await fetch(`/api/khata/customers/${customerId}/opt-in`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId ? { ...c, reminderOptIn: data.reminderOptIn } : c,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to toggle opt-in:", err);
    }
  };

  // Polite Reminder via POST /api/khata/remind
  const handleReminderClick = async (customerId: string) => {
    try {
      const res = await fetch("/api/khata/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });

      const data = await res.json();

      if (res.status === 403) {
        alert("Compliance Rule: Customer has not opted in for reminders (PS2).");
        return;
      }

      if (data.success && data.message) {
        setRemindersSent((prev) => ({ ...prev, [customerId]: true }));
        setReminderModalMessage(data.message);
      }
    } catch (err) {
      console.error("Failed to send reminder:", err);
    }
  };

  const handleMicClick = () => {
    router.push("/shoppr");
  };

  const handleDisambiguationSelect = (candidateId: string) => {
    if (disambiguation?.pendingActions) {
      executeVoiceCommand("", {
        customerId: candidateId,
        pendingActions: disambiguation.pendingActions,
      });
    }
    setDisambiguation(null);
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-surface relative">
      {/* Top Header */}
      <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <div className="flex flex-col min-w-0">
          <span className="font-headline text-title-lg text-on-surface leading-tight font-bold">
            Shoppr
          </span>
          <span className="font-body text-body-sm text-on-surface-variant leading-tight truncate">
            {shopName}
          </span>
        </div>

        {/* Live Alexa-Style Wake Word Status Badge */}
        <button
          type="button"
          onClick={handleMicClick}
          aria-label="Open voice khata stage"
          className="inline-flex items-center gap-gutter-sm rounded-full bg-surface-card border border-outline/10 px-gutter-md py-gutter-xs text-on-surface font-label shrink-0 shadow-sm hover:bg-surface-tint active:scale-95 transition-transform"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isListening ? "bg-live animate-pulse" : "bg-primary-muted"
            }`}
            aria-hidden="true"
          />
          <span className="text-label-sm font-semibold">
            {isListening ? "Listening for 'Shoppr'" : "Voice Khata"}
          </span>
        </button>
      </header>

      {/* Disambiguation Prompt if duplicate customer triggered */}
      {disambiguation && (
        <aside
          role="dialog"
          aria-label="Customer Disambiguation Prompt"
          className="mx-page-margin mb-gutter-sm p-gutter-md bg-accent-container text-on-accent-container border-2 border-accent rounded-lg shadow-md animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-gutter-xs border-b border-accent/20 mb-gutter-xs">
            <span className="font-title text-title-sm font-bold flex items-center gap-gutter-xs">
              <span className="material-symbols-outlined text-body-md">help</span>
              Kaunsa khata chunna hai?
            </span>
            <button
              type="button"
              onClick={() => setDisambiguation(null)}
              className="text-on-accent-container text-label-xs font-bold hover:underline"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-gutter-sm pt-gutter-xs">
            {disambiguation.candidates.map((cand) => (
              <button
                key={cand.id}
                type="button"
                onClick={() => handleDisambiguationSelect(cand.id)}
                className="flex flex-col items-start p-gutter-sm bg-surface-card border border-outline/20 rounded-md hover:border-accent hover:bg-surface-tint active:scale-95 transition-all text-left shadow-sm"
              >
                <span className="font-title text-title-sm font-bold text-on-surface">
                  {cand.name}
                </span>
                <span className="font-label text-label-xs text-accent-text font-semibold">
                  {cand.tag ? `Tag: ${cand.tag}` : "General"}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Polite Reminder Message Modal */}
      {reminderModalMessage && (
        <aside
          role="dialog"
          aria-label="Generated Polite Reminder"
          className="mx-page-margin mb-gutter-sm p-gutter-md bg-live-container text-on-live-container border border-live/30 rounded-lg shadow-md animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-gutter-xs border-b border-live/20 mb-gutter-xs">
            <span className="font-title text-title-sm font-bold flex items-center gap-gutter-xs">
              <span className="material-symbols-outlined text-body-md">check_circle</span>
              Polite Opt-In Reminder Generated
            </span>
            <button
              type="button"
              onClick={() => setReminderModalMessage(null)}
              className="text-on-live-container text-label-xs font-bold hover:underline"
            >
              ✕
            </button>
          </div>
          <p className="font-body text-body-sm italic">&ldquo;{reminderModalMessage}&rdquo;</p>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 px-page-margin pt-gutter-xs pb-dock-clearance flex flex-col gap-gutter-lg">
        {/* Dashboard Summary: Total Khata Overview + 2-Column KPI Row */}
        <section aria-label="Total Market Baaki Overview" className="flex flex-col gap-gutter-md">
          <article className="bg-primary text-on-primary rounded-lg p-gutter-lg flex items-start justify-between gap-gutter-md shadow-sm">
            <div className="flex flex-col gap-gutter-xs">
              <p className="font-body text-body-sm text-on-primary/80">
                Total Market Baaki (Pending Credit)
              </p>
              <p className="font-headline text-display-lg-mobile text-on-primary tabular-nums font-bold">
                ₹{totalMarketBaaki.toLocaleString("en-IN")}
              </p>
              <p className="font-label text-label-sm text-on-primary/75">
                {customers.length} Active Customers
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-accent text-on-accent px-gutter-md py-gutter-xs font-label tabular-nums shrink-0 font-bold">
              <span className="text-label-sm">+₹{todayUdhaar.toLocaleString("en-IN")} Today</span>
            </span>
          </article>

          {/* 2-Column Dashboard Metrics */}
          <div className="grid grid-cols-2 gap-gutter-md items-stretch">
            <article className="h-full bg-surface-card border border-outline/10 rounded-lg p-gutter-md flex flex-col justify-between gap-gutter-xs shadow-sm">
              <p className="font-body text-body-sm text-on-surface-variant">Jama Today</p>
              <p className="font-headline text-headline-md text-live tabular-nums font-bold">
                ₹{todayJama.toLocaleString("en-IN")}
              </p>
            </article>
            <article className="h-full bg-surface-card border border-outline/10 rounded-lg p-gutter-md flex flex-col justify-between gap-gutter-xs shadow-sm">
              <p className="font-body text-body-sm text-on-surface-variant">Opted-In Reminders</p>
              <p className="font-headline text-headline-md text-on-live-container tabular-nums font-bold text-live">
                {customers.filter((c) => c.reminderOptIn).length} / {customers.length}
              </p>
            </article>
          </div>
        </section>

        {/* Segmented Tab Switcher & Quick Search Filter */}
        <section aria-label="Customer Balances List" className="flex flex-col gap-gutter-md">
          {/* Horizontal Tabs */}
          <div role="tablist" aria-label="Ledger views" className="grid grid-cols-2 gap-gutter-xs bg-surface-subtle p-gutter-xs rounded-full border border-outline/10">
            <button
              role="tab"
              id="tab-recent"
              aria-selected={activeTab === "recent"}
              type="button"
              onClick={() => setActiveTab("recent")}
              className={`rounded-full py-gutter-sm px-gutter-md font-label transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                activeTab === "recent"
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="text-label-lg">Recent Entries</span>
            </button>
            <button
              role="tab"
              id="tab-balances"
              aria-selected={activeTab === "balances"}
              type="button"
              onClick={() => setActiveTab("balances")}
              className={`rounded-full py-gutter-sm px-gutter-md font-label transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                activeTab === "balances"
                  ? "bg-primary text-on-primary font-bold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="text-label-lg">Customer Balances</span>
            </button>
          </div>

          {/* Compact Search Bar */}
          <div className="relative flex items-center">
            <span
              className="material-symbols-outlined text-title-md text-primary-muted absolute left-gutter-md pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id="customer-search"
              type="search"
              aria-label="Search customer or speak"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer: e.g. Ramesh, Naresh…"
              className="w-full rounded-full bg-surface-card border border-outline/10 pl-10 pr-gutter-lg py-gutter-sm font-body text-body-sm text-on-surface placeholder:text-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
            />
          </div>

          {/* TAB 1: Customer Balance Cards */}
          {activeTab === "balances" && (
            <div id="customer-cards-list" className="flex flex-col gap-gutter-lg pt-gutter-xs">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <p className="font-body text-body-md">No customer found matching &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const isSent = remindersSent[customer.id];
                  const isSettled = customer.balance === 0;

                  if (isSettled) {
                    return (
                      <article
                        key={customer.id}
                        data-customer-name={customer.name}
                        className="bg-surface-card border border-outline/10 rounded-lg p-gutter-lg flex items-center justify-between gap-gutter-md shadow-sm"
                      >
                        <div className="flex flex-col gap-gutter-xs min-w-0">
                          <h3 className="font-title text-title-md text-on-surface font-semibold">
                            {customer.displayName}
                          </h3>
                          <p className="font-body text-body-sm text-on-surface-variant">
                            {customer.subtitle}
                          </p>
                        </div>
                        <span
                          role="status"
                          className="inline-flex items-center rounded-full bg-primary text-on-primary-white px-gutter-md py-gutter-xs font-label tabular-nums shrink-0 font-bold"
                        >
                          <span className="text-label-sm">₹0 Settled</span>
                        </span>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={customer.id}
                      data-customer-name={customer.name}
                      className="bg-surface-card border border-outline/10 rounded-lg p-gutter-lg flex flex-col gap-gutter-md shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-gutter-md">
                        <div className="flex flex-col gap-gutter-xs min-w-0">
                          <h3 className="font-title text-title-md text-on-surface font-semibold">
                            {customer.displayName}
                          </h3>
                          <p className="font-body text-body-sm text-on-surface-variant">
                            {customer.subtitle}
                          </p>
                        </div>
                        <p className="font-headline text-title-lg text-on-accent-container tabular-nums shrink-0 font-bold">
                          ₹{customer.balance.toLocaleString("en-IN")} Baaki
                        </p>
                      </div>

                      <footer className="flex items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-outline/10">
                        {/* Interactive Toggle for Opt-in (PS2 Rule) */}
                        <button
                          type="button"
                          onClick={() => handleToggleOptIn(customer.id)}
                          aria-label={`Toggle reminder opt-in for ${customer.displayName}`}
                          className="cursor-pointer"
                        >
                          {customer.reminderOptIn ? (
                            <span className="inline-flex items-center gap-gutter-xs rounded-full bg-live-container text-on-live-container px-gutter-md py-gutter-xs font-label hover:opacity-80">
                              <span className="w-1.5 h-1.5 rounded-full bg-live" aria-hidden="true" />
                              <span className="text-label-sm font-medium">Opted-in ✓</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-surface-subtle text-on-surface-variant px-gutter-md py-gutter-xs font-label hover:bg-surface-tint">
                              <span className="text-label-sm font-medium">Opt-in Off (Click to turn on)</span>
                            </span>
                          )}
                        </button>

                        {customer.reminderOptIn ? (
                          <button
                            type="button"
                            onClick={() => handleReminderClick(customer.id)}
                            className={`reminder-btn inline-flex items-center justify-center rounded-full border border-outline/10 px-gutter-md py-gutter-xs font-label transition-colors duration-state-change ease-state-change active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary cursor-pointer ${
                              isSent
                                ? "bg-live-container text-on-live-container font-semibold"
                                : "bg-surface-card text-on-surface hover:bg-surface-tint"
                            }`}
                          >
                            <span className="text-label-sm">
                              {isSent ? "Reminder Sent" : "Polite Reminder"}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => alert("PS2 Compliance Rule: Please click 'Opt-in Off' to enable consent before sending reminders.")}
                            className="inline-flex items-center justify-center rounded-full border border-outline/10 bg-surface-subtle text-on-surface-variant px-gutter-md py-gutter-xs font-label opacity-75 hover:opacity-100"
                          >
                            <span className="text-label-sm">No Opt-In (Protected)</span>
                          </button>
                        )}
                      </footer>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Recent Voice Entries */}
          {activeTab === "recent" && (
            <div className="flex flex-col gap-gutter-md pt-gutter-xs">
              {recentEntries.length === 0 ? (
                <div className="text-center py-8 text-primary-muted font-body text-body-sm">
                  No voice transactions recorded yet.
                </div>
              ) : (
                recentEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="bg-surface-card border border-outline/10 rounded-lg p-gutter-md flex items-center justify-between gap-gutter-md shadow-sm"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-gutter-sm">
                        <span
                          className={`text-label-sm px-2 py-0.5 rounded-full font-bold ${
                            entry.type === "UDHAAR"
                              ? "bg-accent-container text-on-accent-container"
                              : "bg-live-container text-on-live-container"
                          }`}
                        >
                          {entry.type === "UDHAAR" ? "Udhaar" : "Jama"}
                        </span>
                        <h4 className="font-title text-title-md text-on-surface font-semibold truncate">
                          {entry.customerName} {entry.customerTag ? `(${entry.customerTag})` : ""}
                        </h4>
                      </div>
                      <p className="font-body text-body-sm text-on-surface-variant mt-1">
                        {new Date(entry.transactionDate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {entry.notes ? `• ${entry.notes}` : ""}
                      </p>
                    </div>

                    <p
                      className={`font-headline text-title-lg tabular-nums shrink-0 font-bold ${
                        entry.type === "UDHAAR" ? "text-on-accent-container" : "text-live"
                      }`}
                    >
                      {entry.type === "UDHAAR" ? "+" : "-"}₹{entry.amount.toLocaleString("en-IN")}
                    </p>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </main>

      {/* Sticky Bottom Voice Dock (Alexa-Style Wake Word Trigger Dock) */}
      <aside
        aria-label="Voice Ledger Dock"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-20 bg-primary text-on-primary rounded-t-xl px-page-margin pt-gutter-md pb-gutter-lg flex flex-col gap-gutter-sm shadow-2xl"
      >
        {/* Live Voice Q&A Preview */}
        <div className="flex flex-col items-center text-center gap-gutter-xs">
          <p className="font-body text-body-sm text-on-primary/90 text-pretty font-medium">
            &ldquo;{voiceDockCaption}&rdquo;
          </p>
          <span
            role="status"
            className="inline-flex items-center gap-gutter-xs rounded-full bg-surface-card/15 text-on-primary px-gutter-md py-1 font-label text-label-xs"
          >
            <span
              className={`material-symbols-outlined text-label-sm text-accent ${
                isVoiceProcessing ? "animate-spin" : ""
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              {isVoiceProcessing ? "sync" : "volume_up"}
            </span>
            <span className="font-medium truncate max-w-[280px]">
              {voiceDockReply}
            </span>
          </span>
        </div>

        {/* Mic Orb + Waveform + Hands-Free Toggle */}
        <div className="grid grid-cols-3 items-center gap-gutter-sm pt-gutter-xs">
          <div className="flex items-center justify-end gap-gutter-xs pr-gutter-sm" aria-hidden="true">
            <span className={`wave-bar w-1 h-3 rounded-full ${isListening ? "bg-accent animate-pulse" : "bg-accent/40"}`} />
            <span className={`wave-bar wave-bar-2 w-1 h-5 rounded-full ${isListening ? "bg-accent animate-pulse" : "bg-accent/60"}`} />
            <span className={`wave-bar wave-bar-3 w-1 h-7 rounded-full ${isListening ? "bg-accent animate-pulse" : "bg-accent/80"}`} />
          </div>

          <div className="flex justify-center">
            <button
              id="voice-orb-btn"
              type="button"
              onClick={handleMicClick}
              aria-label="Open full voice orb stage"
              className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-on-accent shrink-0 transition-transform duration-state-change ease-state-change hover:opacity-95 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary shadow-lg cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-title-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                mic
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-gutter-xs">
            <div className="flex items-center gap-gutter-xs pl-gutter-sm" aria-hidden="true">
              <span className={`wave-bar wave-bar-3 w-1 h-7 rounded-full ${isListening ? "bg-accent animate-pulse" : "bg-accent/80"}`} />
              <span className={`wave-bar wave-bar-2 w-1 h-5 rounded-full ${isListening ? "bg-accent animate-pulse" : "bg-accent/60"}`} />
              <span className={`wave-bar wave-bar-3 w-1 h-3 rounded-full ${isListening ? "bg-accent animate-pulse" : "bg-accent/40"}`} />
            </div>

            <button
              id="mode-toggle-btn"
              type="button"
              onClick={() => setIsHandsFree((prev) => !prev)}
              aria-pressed={isHandsFree}
              aria-label="Toggle voice input mode"
              className="shrink-0 inline-flex flex-col items-end gap-gutter-xs rounded-md px-gutter-sm py-1 bg-surface-card/10 hover:bg-surface-card/15 transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-on-primary cursor-pointer"
            >
              <div className="flex items-center gap-gutter-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isHandsFree ? "bg-live animate-pulse" : "bg-accent"}`} aria-hidden="true" />
                <span id="mode-label" className="font-label text-label-xs text-on-primary font-medium">
                  {isHandsFree ? "Hands-Free On" : "Hold to Talk"}
                </span>
              </div>
              <span id="mode-sublabel" className="font-label text-[10px] text-on-primary/70">
                {isHandsFree ? "Wake Word Active" : "Tap Orb"}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
