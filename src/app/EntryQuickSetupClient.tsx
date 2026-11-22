"use client";

import { useState, useTransition } from "react";
import { startDemoShop, openOrCreateShop } from "@/app/actions/auth";

export default function EntryQuickSetupClient() {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [shopName, setShopName] = useState("");
  const [location, setLocation] = useState("");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDemoPending, startDemoTransition] = useTransition();
  const [isSubmitPending, startSubmitTransition] = useTransition();

  const handleDemoLaunch = () => {
    setErrorMessage(null);
    startDemoTransition(async () => {
      try {
        await startDemoShop();
      } catch (err: unknown) {
        // Next.js redirect() throws a NEXT_REDIRECT error which is caught if handled improperly
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
        setErrorMessage("Failed to start demo shop. Please check database connection.");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("mode", mode);
    formData.append("mobile", mobile);
    formData.append("pin", pin);
    if (mode === "new") {
      formData.append("shopName", shopName);
      formData.append("location", location);
    }

    startSubmitTransition(async () => {
      try {
        const res = await openOrCreateShop(null, formData);
        if (res?.error) {
          setErrorMessage(res.error);
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
        setErrorMessage("Authentication error. Please try again.");
      }
    });
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col justify-between px-page-margin py-gutter-lg bg-surface gap-gutter-md">
      {/* Centered Brand Header */}
      <header className="flex flex-col items-center text-center gap-gutter-sm pt-gutter-xs">
        {/* Rounded Square Deep Navy App Icon with 5 Vertical Audio Waveform Bars */}
        <div
          className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center shadow-sm"
          aria-hidden="true"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="4" y="12" width="3" height="8" rx="1.5" fill="#F4EDE0" />
            <rect x="9.5" y="7" width="3" height="18" rx="1.5" fill="#FF6B5B" />
            <rect x="15" y="4" width="3" height="24" rx="1.5" fill="#F4EDE0" />
            <rect x="20.5" y="8" width="3" height="16" rx="1.5" fill="#FF6B5B" />
            <rect x="26" y="13" width="3" height="6" rx="1.5" fill="#F4EDE0" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-gutter-xs">
          <h1 className="font-headline text-headline-md text-on-surface font-bold">
            Shoppr
          </h1>
          <p className="font-body text-body-sm text-on-surface-variant">
            Hands-free voice khata for your shop counter
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center gap-gutter-md">
        {/* Instant Demo Launch Section (Top Hero CTA) */}
        <section aria-label="Instant Demo" className="flex flex-col items-center gap-gutter-xs">
          <button
            id="demo-launch-btn"
            type="button"
            disabled={isDemoPending || isSubmitPending}
            onClick={handleDemoLaunch}
            className="w-full inline-flex items-center justify-center gap-gutter-sm rounded-lg bg-accent text-on-accent px-gutter-lg py-gutter-md font-label transition-colors duration-state-change ease-state-change hover:opacity-95 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shadow-sm cursor-pointer disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-title-lg ${
                isDemoPending ? "animate-spin" : ""
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              {isDemoPending ? "sync" : "mic"}
            </span>
            <span className="font-title text-title-md font-semibold">
              {isDemoPending ? "Creating Demo Counter…" : "Try Instant Demo Shop"}
            </span>
          </button>
          <p className="font-label text-label-sm text-primary-muted text-center">
            Pre-loaded sample counter • Disambiguation on Turn 1 • 1 tap
          </p>
        </section>

        {/* Subtle Horizontal Divider */}
        <div
          className="flex items-center gap-gutter-md"
          role="separator"
          aria-label="Or open your shop"
        >
          <span className="flex-1 h-px bg-outline/10" aria-hidden="true" />
          <span className="font-label text-label-sm text-primary-muted uppercase tracking-wider font-semibold">
            OR OPEN YOUR SHOP
          </span>
          <span className="flex-1 h-px bg-outline/10" aria-hidden="true" />
        </div>

        {/* Shop Registration & Login Card */}
        <section
          aria-label="Shop Registration and Login"
          className="bg-surface-card border border-outline/10 rounded-lg p-gutter-lg flex flex-col gap-gutter-md shadow-sm"
        >
          {errorMessage && (
            <div
              role="alert"
              className="p-gutter-sm rounded-md bg-accent-container text-on-accent-container font-label text-label-sm border border-accent/20 flex items-center gap-gutter-xs"
            >
              <span className="material-symbols-outlined text-body-sm" aria-hidden="true">
                error
              </span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Top Pill Toggle Inside Card: New Shop vs Existing Shop */}
          <div
            role="tablist"
            aria-label="Shop account mode"
            className="grid grid-cols-2 gap-gutter-xs bg-surface-subtle p-gutter-xs rounded-full border border-outline/10"
          >
            <button
              role="tab"
              id="tab-new-shop"
              aria-selected={mode === "new"}
              tabIndex={mode === "new" ? 0 : -1}
              type="button"
              onClick={() => {
                setMode("new");
                setErrorMessage(null);
              }}
              className={`rounded-full py-gutter-xs px-gutter-md font-label transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                mode === "new"
                  ? "bg-primary text-on-primary font-semibold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="text-label-lg">New Shop</span>
            </button>
            <button
              role="tab"
              id="tab-existing-shop"
              aria-selected={mode === "existing"}
              tabIndex={mode === "existing" ? 0 : -1}
              type="button"
              onClick={() => {
                setMode("existing");
                setErrorMessage(null);
              }}
              className={`rounded-full py-gutter-xs px-gutter-md font-label transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                mode === "existing"
                  ? "bg-primary text-on-primary font-semibold shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="text-label-lg">Existing Shop</span>
            </button>
          </div>

          <form id="shop-auth-form" onSubmit={handleSubmit} className="flex flex-col gap-gutter-md">
            {/* New Shop Fields */}
            {mode === "new" && (
              <div id="new-shop-fields" className="flex flex-col gap-gutter-md">
                <div className="flex flex-col gap-gutter-xs">
                  <label
                    htmlFor="shop-name"
                    className="font-label text-label-sm text-on-surface font-medium"
                  >
                    Shop Name
                  </label>
                  <input
                    id="shop-name"
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g., Gupta Kirana Store"
                    className="w-full rounded-md bg-surface-tint border border-outline/10 px-gutter-md py-gutter-sm font-body text-body-md text-on-surface placeholder:text-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  />
                </div>

                <div className="flex flex-col gap-gutter-xs">
                  <label
                    htmlFor="shop-location"
                    className="font-label text-label-sm text-on-surface font-medium"
                  >
                    Location / Area (Optional)
                  </label>
                  <input
                    id="shop-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Indiranagar, Bengaluru"
                    className="w-full rounded-md bg-surface-tint border border-outline/10 px-gutter-md py-gutter-sm font-body text-body-md text-on-surface placeholder:text-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* Two-Column Bottom Input Row: Mobile Number (60%) + 4-Digit PIN (40%) */}
            <div className="grid grid-cols-5 gap-gutter-sm">
              <div className="col-span-3 flex flex-col gap-gutter-xs">
                <label
                  htmlFor="shop-mobile"
                  className="font-label text-label-sm text-on-surface font-medium"
                >
                  Mobile Number
                </label>
                <input
                  id="shop-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="w-full rounded-md bg-surface-tint border border-outline/10 px-gutter-md py-gutter-sm font-body text-body-md text-on-surface tabular-nums placeholder:text-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                />
              </div>

              <div className="col-span-2 flex flex-col gap-gutter-xs">
                <label
                  htmlFor="shop-pin"
                  className="font-label text-label-sm text-on-surface font-medium"
                >
                  4-Digit PIN
                </label>
                <input
                  id="shop-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-md bg-surface-tint border border-outline/10 px-gutter-sm py-gutter-sm font-body text-body-md text-on-surface text-center tabular-nums placeholder:text-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="submit-shop-btn"
              type="submit"
              disabled={isSubmitPending || isDemoPending}
              className="w-full inline-flex items-center justify-center rounded-lg bg-primary text-on-primary-white px-gutter-lg py-gutter-md font-label transition-colors duration-state-change ease-state-change hover:opacity-90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span id="submit-shop-label" className="font-title text-title-md font-semibold">
                {isSubmitPending
                  ? "Authenticating…"
                  : mode === "new"
                  ? "Create & Open Counter →"
                  : "Open Counter →"}
              </span>
            </button>
          </form>
        </section>
      </main>

      {/* Minimal Privacy Footer */}
      <footer className="flex items-center justify-center gap-gutter-xs pb-gutter-xs text-primary-muted">
        <span className="material-symbols-outlined text-body-sm" aria-hidden="true">
          lock
        </span>
        <span className="font-label text-label-sm">
          Encrypted khata • Polite opt-in reminders only
        </span>
      </footer>
    </div>
  );
}
