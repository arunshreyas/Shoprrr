"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CustomerCardData {
  id: string;
  name: string;
  displayName: string;
  tag?: string;
  subtitle: string;
  balance: number;
  optedIn: boolean;
  status: "baaki" | "settled";
}

interface RecentEntryData {
  id: string;
  customerName: string;
  type: "UDHAAR" | "JAMA";
  amount: number;
  time: string;
  notes?: string;
}

const INITIAL_CUSTOMERS: CustomerCardData[] = [
  {
    id: "cust_1",
    name: "ramesh sharma ji",
    displayName: "Ramesh (Sharma ji)",
    tag: "Sharma ji",
    subtitle: "Last udhaar: Today • 4 entries",
    balance: 2480,
    optedIn: true,
    status: "baaki",
  },
  {
    id: "cust_2",
    name: "naresh bhai",
    displayName: "Naresh Bhai",
    tag: "Chowk",
    subtitle: "Last udhaar: Today • 2 entries",
    balance: 1840,
    optedIn: false,
    status: "baaki",
  },
  {
    id: "cust_3",
    name: "ramesh electrician",
    displayName: "Ramesh (Electrician)",
    tag: "Electrician",
    subtitle: "Last jama: Yesterday • 3 entries",
    balance: 650,
    optedIn: true,
    status: "baaki",
  },
  {
    id: "cust_4",
    name: "suresh kirana",
    displayName: "Suresh Kirana",
    subtitle: "Settled 2 days ago",
    balance: 0,
    optedIn: true,
    status: "settled",
  },
];

const INITIAL_RECENT_ENTRIES: RecentEntryData[] = [
  {
    id: "tx_1",
    customerName: "Ramesh (Sharma ji)",
    type: "UDHAAR",
    amount: 340,
    time: "2 mins ago",
    notes: "2kg atta, tel",
  },
  {
    id: "tx_2",
    customerName: "Naresh Bhai",
    type: "UDHAAR",
    amount: 500,
    time: "15 mins ago",
    notes: "Dairy & spices",
  },
  {
    id: "tx_3",
    customerName: "Ramesh (Electrician)",
    type: "JAMA",
    amount: 200,
    time: "Yesterday (Kal)",
    notes: "Cash payment",
  },
  {
    id: "tx_4",
    customerName: "Suresh Kirana",
    type: "JAMA",
    amount: 650,
    time: "2 days ago (Parso)",
    notes: "UPI full settlement",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"balances" | "recent">("balances");
  const [searchQuery, setSearchQuery] = useState("");
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [remindersSent, setRemindersSent] = useState<Record<string, boolean>>({});

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return INITIAL_CUSTOMERS;
    return INITIAL_CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        (c.tag && c.tag.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const handleReminderClick = (customerId: string) => {
    setRemindersSent((prev) => ({ ...prev, [customerId]: true }));
  };

  const handleMicClick = () => {
    router.push("/shoppr");
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-surface relative">
      {/* Top Header */}
      <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between gap-gutter-sm">
        <div className="flex flex-col min-w-0">
          <span className="font-headline text-title-lg text-on-surface leading-tight">
            Shoppr
          </span>
          <span className="font-body text-body-sm text-on-surface-variant leading-tight">
            Gupta Kirana Store
          </span>
        </div>

        {/* Live Badge */}
        <span
          role="status"
          className="inline-flex items-center gap-gutter-sm rounded-full bg-surface-card border border-outline/10 px-gutter-md py-gutter-xs text-on-surface font-label shrink-0 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-live animate-pulse shrink-0" aria-hidden="true" />
          <span className="text-label-sm font-semibold">Listening for &apos;Shoppr&apos;</span>
        </span>
      </header>

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
                ₹14,820
              </p>
              <p className="font-label text-label-sm text-on-primary/75">
                18 Active Customers
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-accent text-on-accent px-gutter-md py-gutter-xs font-label tabular-nums shrink-0 font-bold">
              <span className="text-label-sm">+₹1,450 Today</span>
            </span>
          </article>

          {/* 2-Column Dashboard Metrics */}
          <div className="grid grid-cols-2 gap-gutter-md items-stretch">
            <article className="h-full bg-surface-card border border-outline/10 rounded-lg p-gutter-md flex flex-col justify-between gap-gutter-xs shadow-sm">
              <p className="font-body text-body-sm text-on-surface-variant">Jama Today</p>
              <p className="font-headline text-headline-md text-primary tabular-nums font-bold">
                ₹800
              </p>
            </article>
            <article className="h-full bg-surface-card border border-outline/10 rounded-lg p-gutter-md flex flex-col justify-between gap-gutter-xs shadow-sm">
              <p className="font-body text-body-sm text-on-surface-variant">Opted-In Reminders</p>
              <p className="font-headline text-headline-md text-on-live-container tabular-nums font-bold text-live">
                12 / 18
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
              placeholder="Search customer or speak 'Shoppr, Naresh ka total?'"
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

                  if (customer.status === "settled") {
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
                          ₹{customer.balance.toLocaleString()} Baaki
                        </p>
                      </div>

                      <footer className="flex items-center justify-between gap-gutter-sm pt-gutter-sm border-t border-outline/10">
                        {customer.optedIn ? (
                          <span className="inline-flex items-center gap-gutter-xs rounded-full bg-live-container text-on-live-container px-gutter-md py-gutter-xs font-label">
                            <span className="w-1.5 h-1.5 rounded-full bg-live" aria-hidden="true" />
                            <span className="text-label-sm font-medium">Opted-in</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-surface-subtle text-on-surface-variant px-gutter-md py-gutter-xs font-label">
                            <span className="text-label-sm font-medium">Reminders Off</span>
                          </span>
                        )}

                        {customer.optedIn ? (
                          <button
                            type="button"
                            onClick={() => handleReminderClick(customer.id)}
                            className={`reminder-btn inline-flex items-center justify-center rounded-full border border-outline/10 px-gutter-md py-gutter-xs font-label transition-colors duration-state-change ease-state-change active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
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
                            disabled
                            className="inline-flex items-center justify-center rounded-full border border-outline/10 bg-surface-subtle text-on-surface-variant px-gutter-md py-gutter-xs font-label cursor-not-allowed opacity-75"
                          >
                            <span className="text-label-sm">No Opt-In</span>
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
              {INITIAL_RECENT_ENTRIES.map((entry) => (
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
                        {entry.customerName}
                      </h4>
                    </div>
                    <p className="font-body text-body-sm text-on-surface-variant mt-1">
                      {entry.time} {entry.notes ? `• ${entry.notes}` : ""}
                    </p>
                  </div>

                  <p
                    className={`font-headline text-title-lg tabular-nums shrink-0 font-bold ${
                      entry.type === "UDHAAR" ? "text-on-accent-container" : "text-live"
                    }`}
                  >
                    {entry.type === "UDHAAR" ? "+" : "-"}₹{entry.amount.toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Sticky Bottom Voice Dock */}
      <aside
        aria-label="Voice Ledger Dock"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-20 bg-primary text-on-primary rounded-t-xl px-page-margin pt-gutter-lg pb-gutter-lg flex flex-col gap-gutter-md shadow-2xl"
      >
        {/* Live Voice Q&A Preview */}
        <div className="flex flex-col items-center text-center gap-gutter-sm">
          <p className="font-body text-body-md text-on-primary text-pretty">
            &ldquo;Shoppr, kitna baaki hai Naresh bhai ko?&rdquo;
          </p>
          <span
            role="status"
            className="inline-flex items-center gap-gutter-xs rounded-full bg-surface-card/15 text-on-primary px-gutter-md py-gutter-xs font-label"
          >
            <span
              className="material-symbols-outlined text-body-sm text-accent"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              volume_up
            </span>
            <span className="text-label-sm font-medium">Naresh bhai ka total ₹1,840 baaki hai.</span>
          </span>
        </div>

        {/* Mic Orb + Waveform + Hands-Free Toggle */}
        <div className="grid grid-cols-3 items-center gap-gutter-sm pt-gutter-xs">
          <div className="flex items-center justify-end gap-gutter-xs pr-gutter-sm" aria-hidden="true">
            <span className="wave-bar w-1 h-3 rounded-full bg-accent/60" />
            <span className="wave-bar wave-bar-2 w-1 h-5 rounded-full bg-accent/80" />
            <span className="wave-bar wave-bar-3 w-1 h-7 rounded-full bg-accent" />
          </div>

          <div className="flex justify-center">
            <button
              id="voice-orb-btn"
              type="button"
              onClick={handleMicClick}
              aria-label="Tap to speak ledger query"
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent text-on-accent shrink-0 transition-transform duration-state-change ease-state-change hover:opacity-95 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary shadow-lg cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-headline-md"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                mic
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-gutter-xs">
            <div className="flex items-center gap-gutter-xs pl-gutter-sm" aria-hidden="true">
              <span className="wave-bar wave-bar-3 w-1 h-7 rounded-full bg-accent" />
              <span className="wave-bar wave-bar-2 w-1 h-5 rounded-full bg-accent/80" />
              <span className="wave-bar w-1 h-3 rounded-full bg-accent/60" />
            </div>

            <button
              id="mode-toggle-btn"
              type="button"
              onClick={() => setIsHandsFree((prev) => !prev)}
              aria-pressed={isHandsFree}
              aria-label="Toggle voice input mode"
              className="shrink-0 inline-flex flex-col items-end gap-gutter-xs rounded-md px-gutter-sm py-gutter-xs bg-surface-card/10 hover:bg-surface-card/15 transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-on-primary cursor-pointer"
            >
              <div className="flex items-center gap-gutter-xs">
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden="true" />
                <span id="mode-label" className="font-label text-label-sm text-on-primary font-medium">
                  {isHandsFree ? "Hands-Free" : "Hold to Talk"}
                </span>
              </div>
              <span id="mode-sublabel" className="font-label text-label-sm text-on-primary/70">
                {isHandsFree ? "Hold to Talk" : "Hands-Free"}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
