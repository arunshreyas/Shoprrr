"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutShop } from "@/app/actions/auth";

interface CustomerCandidate {
  id: string;
  name: string;
  tag: string | null;
  phone: string | null;
  balance?: number;
}

interface DisambiguationData {
  candidates: CustomerCandidate[];
  pendingActions?: Array<{
    type: "UDHAAR" | "JAMA";
    amount: number;
    transactionDate?: string;
    notes?: string;
  }>;
  pendingQuery?: boolean;
}

interface TransactionItem {
  id: string;
  customerName: string;
  customerTag: string | null;
  type: "UDHAAR" | "JAMA";
  amount: number;
  notes: string | null;
  createdAt: string;
}

export default function ShopprVoicePage() {
  const router = useRouter();
  const [shopName, setShopName] = useState<string>("Khata Counter");
  const [isHearing, setIsHearing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [replyText, setReplyText] = useState<string>(
    "Namaste! Bolein: 'Ramesh ka 340 udhaar' ya 'Naresh bhai ka hisab'.",
  );
  const [disambiguation, setDisambiguation] = useState<DisambiguationData | null>(null);
  const [textInput, setTextInput] = useState("");
  const [todayUdhaar, setTodayUdhaar] = useState(0);
  const [todayJama, setTodayJama] = useState(0);
  const [recentTxs, setRecentTxs] = useState<TransactionItem[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);

  const [, startLogoutTransition] = useTransition();
  const recognitionRef = useRef<any>(null);

  // Fetch initial ledger state
  const fetchState = async () => {
    try {
      const res = await fetch("/api/khata/state");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      if (data.success) {
        if (data.shop?.shopName) {
          setShopName(data.shop.shopName);
        }
        if (data.today) {
          setTodayUdhaar(data.today.udhaar || 0);
          setTodayJama(data.today.jama || 0);
        }
        if (data.transactions) {
          setRecentTxs(data.transactions.slice(0, 5));
        }
      }
    } catch (err) {
      console.error("Failed to load khata state:", err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Audio Text-to-Speech (TTS)
  const speakReply = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN"; // Hindi / Indian English
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Execute Command API
  const sendCommand = async (
    transcript: string,
    disambiguationResolve?: { customerId: string; pendingActions: any[] },
  ) => {
    setIsProcessing(true);
    setLastTranscript(transcript);

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

      if (res.status === 401) {
        router.push("/");
        return;
      }

      const data = await res.json();

      if (data.replyText) {
        setReplyText(data.replyText);
        speakReply(data.replyText);
      }

      if (data.disambiguation) {
        setDisambiguation(data.disambiguation);
      } else {
        setDisambiguation(null);
      }

      if (data.state) {
        if (data.state.today) {
          setTodayUdhaar(data.state.today.udhaar || 0);
          setTodayJama(data.state.today.jama || 0);
        }
        if (data.state.transactions) {
          setRecentTxs(data.state.transactions.slice(0, 5));
        }
      }
    } catch (err) {
      console.error("Command error:", err);
      setReplyText("Kuch gadbad ho gayi. Kripya dubara bolein.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Initialize Speech Recognition if supported
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "hi-IN";

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        if (transcript.trim()) {
          sendCommand(transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
      };

      recognitionRef.current = recognition;

      if (isHearing) {
        try {
          recognition.start();
        } catch {
          // Already active
        }
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
  }, []);

  const toggleHearing = () => {
    const next = !isHearing;
    setIsHearing(next);

    if (recognitionRef.current) {
      if (next) {
        try {
          recognitionRef.current.start();
        } catch {
          // Ignore
        }
      } else {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    }
  };

  const handleDisambiguationSelect = (candidateId: string) => {
    if (disambiguation?.pendingActions) {
      sendCommand("", {
        customerId: candidateId,
        pendingActions: disambiguation.pendingActions,
      });
    } else {
      // Pending Query selection
      const cand = disambiguation?.candidates.find((c) => c.id === candidateId);
      if (cand) {
        sendCommand(`${cand.name} ${cand.tag || ""} ka hisab`);
      }
      setDisambiguation(null);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    sendCommand(textInput.trim());
    setTextInput("");
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col justify-between bg-surface relative overflow-x-hidden">
      {/* Top Bar: Back Button, Shop Name Pill, Ledger Drawer Toggle */}
      <header className="px-page-margin pt-gutter-lg pb-gutter-xs flex items-center justify-between z-20">
        <button
          id="back-btn"
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Back to dashboard"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-card border border-outline/10 text-on-surface transition-colors hover:bg-surface-tint active:scale-95 shadow-sm"
        >
          <span className="material-symbols-outlined text-title-md" aria-hidden="true">
            arrow_back
          </span>
        </button>

        {/* Active Shop & Hearing Pill */}
        <div className="inline-flex items-center gap-gutter-xs rounded-full bg-surface-card border border-outline/10 px-gutter-md py-1 shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isHearing ? "bg-live animate-pulse" : "bg-primary-muted"
            }`}
            aria-hidden="true"
          />
          <span className="font-label text-label-sm font-semibold text-on-surface truncate max-w-[140px]">
            {shopName}
          </span>
        </div>

        {/* Quick Ledger Drawer Button */}
        <button
          type="button"
          onClick={() => setShowDrawer((prev) => !prev)}
          aria-label="Toggle recent ledger entries"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-card border border-outline/10 text-on-surface transition-colors hover:bg-surface-tint active:scale-95 shadow-sm"
        >
          <span className="material-symbols-outlined text-title-md" aria-hidden="true">
            menu_book
          </span>
        </button>
      </header>

      {/* Disambiguation Modal / Notification Banner */}
      {disambiguation && (
        <section
          role="dialog"
          aria-label="Customer Disambiguation"
          className="mx-page-margin my-gutter-xs p-gutter-md bg-accent-container border-2 border-accent rounded-lg shadow-md z-30 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-gutter-xs text-on-accent-container mb-gutter-xs">
            <span className="material-symbols-outlined text-title-md" aria-hidden="true">
              help
            </span>
            <span className="font-headline text-headline-sm font-bold">
              Kaunsa khata chunna hai?
            </span>
          </div>
          <p className="font-body text-body-sm text-on-accent-container mb-gutter-sm">
            Is naam se ek se zyada grahak hain. Kripya sahi khata chunein:
          </p>
          <div className="grid grid-cols-2 gap-gutter-sm">
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
                {cand.phone && (
                  <span className="font-body text-body-xs text-primary-muted">
                    {cand.phone}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Center Stage: Modern Animated Coral Voice Orb */}
      <main className="flex-1 px-page-margin py-gutter-sm flex flex-col items-center justify-center gap-gutter-md">
        <div
          id="voice-orb-stage"
          className={`relative flex items-center justify-center w-64 h-64 ${
            isHearing ? "is-hearing" : ""
          }`}
        >
          {/* Expanding Ripple Rings */}
          <span
            className="orb-ring-1 absolute w-40 h-40 rounded-full border border-accent/40 pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="orb-ring-2 absolute w-40 h-40 rounded-full border border-accent/30 pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="orb-ring-3 absolute w-40 h-40 rounded-full border border-primary/20 pointer-events-none"
            aria-hidden="true"
          />

          {/* Rotating Halo */}
          <span
            className="orb-halo absolute w-44 h-44 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
            aria-hidden="true"
          />

          {/* Interactive Voice Orb */}
          <button
            id="center-voice-orb"
            type="button"
            onClick={toggleHearing}
            aria-pressed={isHearing}
            aria-label="Pause or resume listening"
            className="orb-core relative z-10 w-36 h-36 rounded-full bg-accent text-on-accent border-4 border-primary flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-lg"
          >
            {isProcessing ? (
              <span className="material-symbols-outlined text-display-md animate-spin text-primary">
                progress_activity
              </span>
            ) : (
              <div
                className="flex items-center justify-center gap-gutter-sm h-10"
                aria-hidden="true"
              >
                <span className="eq-bar eq-bar-1 w-1.5 h-4 rounded-full bg-primary" />
                <span className="eq-bar eq-bar-2 w-1.5 h-8 rounded-full bg-primary" />
                <span className="eq-bar eq-bar-3 w-1.5 h-10 rounded-full bg-primary" />
                <span className="eq-bar eq-bar-4 w-1.5 h-8 rounded-full bg-primary" />
                <span className="eq-bar eq-bar-5 w-1.5 h-4 rounded-full bg-primary" />
              </div>
            )}
          </button>
        </div>

        {/* Live Natural Spoken Reply Bubble */}
        <div
          role="status"
          aria-live="polite"
          className="w-full bg-surface-card border border-outline/10 rounded-lg p-gutter-md shadow-sm flex flex-col gap-gutter-xs text-center animate-in fade-in duration-200"
        >
          {lastTranscript && (
            <p className="font-label text-label-xs text-primary-muted italic">
              Aapne kaha: &ldquo;{lastTranscript}&rdquo;
            </p>
          )}
          <p className="font-headline text-headline-sm font-semibold text-primary">
            {replyText}
          </p>
        </div>

        {/* Quick Testing Phrase Chips (Hinglish PS2 test cases) */}
        <div className="w-full flex flex-col gap-gutter-xs">
          <span className="font-label text-label-xs text-primary-muted uppercase tracking-wider text-center">
            Tap a quick sample command:
          </span>
          <div className="flex flex-wrap justify-center gap-gutter-xs">
            <button
              type="button"
              onClick={() => sendCommand("Ramesh ka 340 udhaar, kal 200 diya tha")}
              className="text-label-xs font-medium px-gutter-sm py-1 rounded-full bg-surface-card border border-outline/10 text-on-surface hover:bg-surface-tint active:scale-95"
            >
              &ldquo;Ramesh ka 340 udhaar, kal 200 diya tha&rdquo;
            </button>
            <button
              type="button"
              onClick={() => sendCommand("nahi, 430")}
              className="text-label-xs font-medium px-gutter-sm py-1 rounded-full bg-accent-container border border-accent/20 text-on-accent-container hover:bg-accent/20 active:scale-95"
            >
              &ldquo;nahi, 430&rdquo; (Undo/Correct)
            </button>
            <button
              type="button"
              onClick={() => sendCommand("Naresh bhai ka kitna baaki hai?")}
              className="text-label-xs font-medium px-gutter-sm py-1 rounded-full bg-surface-card border border-outline/10 text-on-surface hover:bg-surface-tint active:scale-95"
            >
              &ldquo;Naresh bhai ka kitna baaki hai?&rdquo;
            </button>
            <button
              type="button"
              onClick={() => sendCommand("Aaj kitna udhaar gaya?")}
              className="text-label-xs font-medium px-gutter-sm py-1 rounded-full bg-surface-card border border-outline/10 text-on-surface hover:bg-surface-tint active:scale-95"
            >
              &ldquo;Aaj kitna udhaar gaya?&rdquo;
            </button>
          </div>
        </div>
      </main>

      {/* Slide-Up Quick Ledger Drawer */}
      {showDrawer && (
        <section
          aria-label="Today Ledger Drawer"
          className="mx-page-margin mb-gutter-xs p-gutter-md bg-surface-card border border-outline/15 rounded-lg shadow-md z-30"
        >
          <div className="flex items-center justify-between mb-gutter-sm pb-gutter-xs border-b border-outline/10">
            <span className="font-title text-title-sm font-bold text-on-surface">
              Aaj Ka Khata Status
            </span>
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="text-primary-muted hover:text-on-surface text-label-xs"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-gutter-sm mb-gutter-md">
            <div className="p-gutter-sm rounded-md bg-surface-tint border border-outline/10">
              <span className="font-label text-label-xs text-primary-muted block">
                Aaj Ka Udhaar
              </span>
              <span className="font-headline text-headline-sm font-bold text-accent-text">
                ₹{todayUdhaar.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="p-gutter-sm rounded-md bg-surface-tint border border-outline/10">
              <span className="font-label text-label-xs text-primary-muted block">
                Aaj Ki Jama
              </span>
              <span className="font-headline text-headline-sm font-bold text-live">
                ₹{todayJama.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <span className="font-label text-label-xs text-primary-muted uppercase tracking-wider block mb-gutter-xs">
            Recent Entries:
          </span>
          <div className="flex flex-col gap-gutter-xs max-h-36 overflow-y-auto">
            {recentTxs.length === 0 ? (
              <p className="font-body text-body-xs text-primary-muted">
                Abhi tak koyi entry nahi hui hai.
              </p>
            ) : (
              recentTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between text-body-xs p-1 rounded bg-surface-subtle/50"
                >
                  <span className="font-medium text-on-surface truncate">
                    {tx.customerName} {tx.customerTag ? `(${tx.customerTag})` : ""}
                  </span>
                  <span
                    className={`font-semibold ${
                      tx.type === "UDHAAR" ? "text-accent-text" : "text-live"
                    }`}
                  >
                    {tx.type === "UDHAAR" ? "+" : "-"}₹{tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Bottom Command Input Bar */}
      <footer className="px-page-margin pb-gutter-md pt-gutter-xs bg-surface z-20">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-gutter-xs">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type command: e.g. Ramesh ka 340 udhaar…"
            className="flex-1 rounded-full bg-surface-card border border-outline/15 px-gutter-md py-gutter-sm font-body text-body-sm text-on-surface placeholder:text-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isProcessing}
            aria-label="Send typed khata command"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-primary text-on-primary-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-40 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-title-md" aria-hidden="true">
              send
            </span>
          </button>
        </form>

        <div className="flex items-center justify-between pt-gutter-xs text-primary-muted text-label-xs">
          <span>Hands-free Voice Khata</span>
          <button
            type="button"
            onClick={() => startLogoutTransition(() => logoutShop())}
            className="underline hover:text-on-surface"
          >
            Logout
          </button>
        </div>
      </footer>
    </div>
  );
}
