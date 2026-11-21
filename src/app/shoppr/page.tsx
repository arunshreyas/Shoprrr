"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ShopprVoicePage() {
  const router = useRouter();
  const [isHearing, setIsHearing] = useState(true);

  const toggleHearing = () => {
    setIsHearing((prev) => !prev);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-surface">
      {/* Minimal Top Bar: Back Arrow on Top Left */}
      <header className="px-page-margin pt-gutter-lg pb-gutter-md flex items-center justify-between">
        <button
          id="back-btn"
          type="button"
          onClick={handleBack}
          aria-label="Back to ledger"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-surface-card border border-outline/10 text-on-surface transition-colors duration-state-change ease-state-change hover:bg-surface-tint active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-title-lg" aria-hidden="true">
            arrow_back
          </span>
        </button>

        {/* Minimal Live Dot Pill */}
        <span
          id="hearing-status-pill"
          role="status"
          className="inline-flex items-center gap-gutter-sm rounded-full bg-surface-card border border-outline/10 px-gutter-md py-gutter-xs text-on-surface font-label"
        >
          <span
            id="hearing-dot"
            className={`w-2 h-2 rounded-full shrink-0 ${
              isHearing ? "bg-live animate-pulse" : "bg-primary-muted"
            }`}
            aria-hidden="true"
          />
          <span id="hearing-status-text" className="text-label-sm font-semibold">
            {isHearing ? "Listening" : "Paused"}
          </span>
        </span>
      </header>

      {/* Center Stage: Clean Modern Animated Voice Orb */}
      <main className="flex-1 px-page-margin pb-gutter-xl flex flex-col items-center justify-center gap-gutter-xl">
        <div
          id="voice-orb-stage"
          className={`relative flex items-center justify-center w-72 h-72 ${
            isHearing ? "is-hearing" : ""
          }`}
        >
          {/* Expanding Ripple Rings */}
          <span
            className="orb-ring-1 absolute w-44 h-44 rounded-full border border-accent/40 pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="orb-ring-2 absolute w-44 h-44 rounded-full border border-accent/30 pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="orb-ring-3 absolute w-44 h-44 rounded-full border border-primary/20 pointer-events-none"
            aria-hidden="true"
          />

          {/* Rotating Subtle Halo */}
          <span
            className="orb-halo absolute w-48 h-48 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
            aria-hidden="true"
          />

          {/* Interactive Coral Voice Orb */}
          <button
            id="center-voice-orb"
            type="button"
            onClick={toggleHearing}
            aria-pressed={isHearing}
            aria-label="Pause or resume listening"
            className="orb-core relative z-10 w-40 h-40 rounded-full bg-accent text-on-accent border-4 border-primary flex items-center justify-center cursor-pointer transition-colors duration-state-change ease-state-change focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {/* Live Animated Equalizer Bars inside the Orb */}
            <div
              className="flex items-center justify-center gap-gutter-sm h-12"
              aria-hidden="true"
            >
              <span className="eq-bar eq-bar-1 w-1.5 h-5 rounded-full bg-primary" />
              <span className="eq-bar eq-bar-2 w-1.5 h-9 rounded-full bg-primary" />
              <span className="eq-bar eq-bar-3 w-1.5 h-12 rounded-full bg-primary" />
              <span className="eq-bar eq-bar-4 w-1.5 h-9 rounded-full bg-primary" />
              <span className="eq-bar eq-bar-5 w-1.5 h-5 rounded-full bg-primary" />
            </div>
          </button>
        </div>

        <p
          id="orb-caption"
          className="font-body text-body-md text-on-surface-variant text-center"
        >
          {isHearing ? "Listening…" : "Tap orb to listen"}
        </p>
      </main>
    </div>
  );
}
