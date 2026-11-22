import type { TxType, LedgerActionItem } from "./khata";

export type ParsedIntentType =
  | "RECORD"
  | "CORRECT_LAST"
  | "QUERY_CUSTOMER"
  | "QUERY_TODAY"
  | "CLARIFY_CUSTOMER";

export interface ParsedCommand {
  intent: ParsedIntentType;
  rawCustomerName?: string;
  spokenTag?: string;
  actions?: LedgerActionItem[];
  newAmount?: number;
  clarifiedCandidateId?: string;
}

const HINDI_NUMBER_WORDS: Record<string, number> = {
  shunya: 0,
  zero: 0,
  ek: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  tin: 3,
  three: 3,
  chaar: 4,
  char: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  saat: 7,
  sat: 7,
  seven: 7,
  aath: 8,
  ath: 8,
  eight: 8,
  nau: 9,
  no: 9,
  nine: 9,
  das: 10,
  dus: 10,
  ten: 10,
  gyarah: 11,
  eleven: 11,
  baarah: 12,
  barah: 12,
  twelve: 12,
  terah: 13,
  thirteen: 13,
  chaudah: 14,
  fourteen: 14,
  pandrah: 15,
  fifteen: 15,
  solah: 16,
  sixteen: 16,
  satrah: 17,
  seventeen: 17,
  athaarah: 18,
  atharah: 18,
  eighteen: 18,
  unnees: 19,
  nineteen: 19,
  bees: 20,
  twenty: 20,
  ikhees: 21,
  baees: 22,
  teees: 23,
  chaubees: 24,
  pachees: 25,
  pachis: 25,
  tees: 30,
  tis: 30,
  thirty: 30,
  paitees: 35,
  chaalis: 40,
  chalis: 40,
  forty: 40,
  paitaalis: 45,
  pachaas: 50,
  pachas: 50,
  fifty: 50,
  saath: 60,
  sath: 60,
  sixty: 60,
  sattar: 70,
  seventy: 70,
  pachattar: 75,
  assi: 80,
  eighty: 80,
  pachaasi: 85,
  nabbe: 90,
  navve: 90,
  ninety: 90,
  panchanve: 95,
};

/**
 * Parses spoken Hinglish or numeric digits into a whole rupee number.
 * Handles "teen sau chaalis" -> 340, "paanch sau" -> 500, "340" -> 340, "dhai sau" -> 250.
 */
export function parseHinglishNumber(text: string): number | null {
  const clean = text.toLowerCase().replace(/,/g, "").trim();

  // 1. Direct digit match (e.g. "340", "₹340", "430", "1840")
  const digitMatch = clean.match(/(?:₹\s*|\b)(\d+)(?:\b|$)/);
  if (digitMatch && digitMatch[1]) {
    return parseInt(digitMatch[1], 10);
  }

  // 2. Hindi fractions / spoken combinations
  if (/\b(?:dedh|derh)\s*sau\b/.test(clean)) return 150;
  if (/\b(?:dedh|derh)\s*haza?ar\b/.test(clean)) return 1500;
  if (/\bdhai\s*sau\b/.test(clean)) return 250;
  if (/\bdhai\s*haza?ar\b/.test(clean)) return 2500;

  // 3. Spoken word accumulation
  const words = clean.split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let currentGroup = 0;
  let hasNumber = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;

    if (HINDI_NUMBER_WORDS[word] !== undefined) {
      currentGroup += HINDI_NUMBER_WORDS[word]!;
      hasNumber = true;
    } else if (word === "sau" || word === "so" || word === "hundred") {
      currentGroup = (currentGroup === 0 ? 1 : currentGroup) * 100;
      hasNumber = true;
    } else if (
      word === "hazaar" ||
      word === "hazar" ||
      word === "thousand" ||
      word === "k"
    ) {
      currentGroup = (currentGroup === 0 ? 1 : currentGroup) * 1000;
      total += currentGroup;
      currentGroup = 0;
      hasNumber = true;
    } else if (word === "lakh" || word === "lac") {
      currentGroup = (currentGroup === 0 ? 1 : currentGroup) * 100000;
      total += currentGroup;
      currentGroup = 0;
      hasNumber = true;
    }
  }

  total += currentGroup;
  return hasNumber && total > 0 ? total : null;
}

/**
 * Parses relative dates from Hinglish phrases ("aaj", "kal", "parso").
 */
export function parseRelativeDate(text: string): Date {
  const lower = text.toLowerCase();
  const now = new Date();

  if (/\b(?:parso|parson|day before yesterday)\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return d;
  }

  if (/\b(?:kal|yesterday|beeta kal)\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }

  // Default to today
  return now;
}

/**
 * Determines transaction type: UDHAAR (credit given) or JAMA (payment received).
 */
export function parseTxType(text: string): TxType {
  const lower = text.toLowerCase();

  // Explicit payment / deposit keywords
  const jamaKeywords = [
    "jama",
    "diya tha",
    "de gaya",
    "dekar gaya",
    "diye the",
    "mila",
    "mile",
    "aaya",
    "aaye",
    "aagaya",
    "pay kiya",
    "payment",
    "vasool",
    "cash",
    "chukta",
    "paid",
    "received",
  ];

  for (const kw of jamaKeywords) {
    if (lower.includes(kw)) {
      return "JAMA";
    }
  }

  // Default for Kirana khata ledger entry is UDHAAR
  return "UDHAAR";
}

/**
 * Clean and extract customer name from spoken phrase.
 */
function extractCustomerName(phrase: string): string | null {
  let cleaned = phrase.trim();

  // Remove common prefix greetings/fillers
  cleaned = cleaned.replace(/^(?:shoppr|shoppar|arre|suno|bhai|hello)\s+/i, "");

  // Match: "[Name] ka/ko/ki/ke"
  const relMatch = cleaned.match(/^([a-zA-Z\u0900-\u097F\s]+?)\s+(?:ka|ko|ke|ki|ne)\b/i);
  if (relMatch && relMatch[1]) {
    const name = relMatch[1].trim();
    if (name && !["aaj", "kal", "parso"].includes(name.toLowerCase())) {
      return name;
    }
  }

  // Pronoun matches
  const pronounMatch = cleaned.match(/\b(unka|uska|unhone|unko|vo|inka|iska)\b/i);
  if (pronounMatch && pronounMatch[1]) {
    return pronounMatch[1].toLowerCase();
  }

  // Match before number or action
  const words = cleaned.split(/\s+/);
  const nameParts: string[] = [];
  for (const w of words) {
    const isNum = parseHinglishNumber(w) !== null || /^\d+$/.test(w);
    const isKeyword = ["udhaar", "udhar", "jama", "baaki", "likh", "likho", "diya", "kal", "aaj"].includes(w.toLowerCase());
    if (isNum || isKeyword) break;
    nameParts.push(w);
  }

  if (nameParts.length > 0) {
    return nameParts.join(" ").trim();
  }

  return null;
}

/**
 * Parses a spoken Hinglish transcript into a structured action command.
 */
export function parseHinglishCommand(transcript: string): ParsedCommand {
  const clean = transcript.trim().toLowerCase();

  // 1. Spoken Instant Correction / Undo ("nahi, 430", "nahi 430", "undo", "wapas lo", "galat ho gaya")
  const isCorrection =
    /^(?:nahi|nahin|no|galat|undo|wapas|cancel|hatao)\b/i.test(clean) ||
    /\b(?:nahi|nahin|galat)\s*,\s*\d+/i.test(clean);

  if (isCorrection) {
    const newAmount = parseHinglishNumber(clean);
    return {
      intent: "CORRECT_LAST",
      newAmount: newAmount ?? undefined,
    };
  }

  // 2. Query Today ("aaj kitna udhaar gaya?", "aaj ka hisab", "aaj total jama kitna hua?")
  const isTodayQuery =
    /\b(?:aaj|today)\b/i.test(clean) &&
    /\b(?:kitna|hisab|total|summary|batao|kya hua|status)\b/i.test(clean);

  if (isTodayQuery) {
    return {
      intent: "QUERY_TODAY",
    };
  }

  // 3. Query Customer ("Naresh bhai ka kitna baaki hai?", "Ramesh ka hisab batao", "unka kitna hai?")
  const isCustomerQuery =
    /\b(?:kitna baaki|kitna hai|hisab batao|kya hisab|balance|total baaki)\b/i.test(clean) ||
    (/\b(?:hisab|baaki)\b/i.test(clean) && !/\b(?:likh|likho|likhna|kar do|darj)\b/i.test(clean));

  if (isCustomerQuery) {
    const name = extractCustomerName(clean) || "unka";
    return {
      intent: "QUERY_CUSTOMER",
      rawCustomerName: name,
    };
  }

  // 4. Clarification answer (e.g., merchant says "Sharma ji" or "Electrician wala")
  if (/^(?:sharma ji|electrician|chowk|market)(?:\s+wala)?$/i.test(clean)) {
    return {
      intent: "CLARIFY_CUSTOMER",
      spokenTag: clean.replace(/\s+wala$/i, "").trim(),
    };
  }

  // 5. Transaction Record (single or compound: "Ramesh ka 340 udhaar, kal 200 diya tha")
  // Split on commas, "aur", or "and" for compound statements
  const clauses = transcript
    .split(/[,]|(?:\s+aur\s+)|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  let rawCustomerName: string | undefined = undefined;
  const actions: LedgerActionItem[] = [];

  for (const clause of clauses) {
    const amount = parseHinglishNumber(clause);
    if (!amount) continue;

    const detectedName = extractCustomerName(clause);
    if (detectedName && !rawCustomerName) {
      rawCustomerName = detectedName;
    }

    const type = parseTxType(clause);
    const date = parseRelativeDate(clause);

    // Extract notes if items were mentioned (e.g., "2kg atta, tel")
    let notes: string | undefined = undefined;
    const itemMatch = clause.match(/(?:atta|tel|chawal|cheeni|shakkar|doodh|biscuit|soap|chai|ration|samaan)/i);
    if (itemMatch) {
      notes = clause;
    }

    actions.push({
      type,
      amount,
      transactionDate: date,
      notes,
    });
  }

  if (actions.length > 0) {
    return {
      intent: "RECORD",
      rawCustomerName: rawCustomerName || "unka",
      actions,
    };
  }

  // Fallback if not recognized as record but has name
  const fallbackName = extractCustomerName(clean);
  if (fallbackName) {
    return {
      intent: "QUERY_CUSTOMER",
      rawCustomerName: fallbackName,
    };
  }

  return {
    intent: "QUERY_TODAY",
  };
}
