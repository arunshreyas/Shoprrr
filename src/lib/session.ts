import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "shoppr_session";
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "shoppr_kirana_bolbharat_default_secret_key_2026_ps2_jwt",
);

export interface SessionPayload {
  shopId: string;
}

/**
 * Creates an encrypted JWT session cookie storing { shopId }.
 */
export async function createSession(shopId: string): Promise<string> {
  const jwt = await new SignJWT({ shopId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });

  return jwt;
}

/**
 * Verifies and reads the active session from cookieStore.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ["HS256"],
    });

    if (!payload || typeof payload.shopId !== "string") {
      return null;
    }

    return { shopId: payload.shopId };
  } catch {
    return null;
  }
}

/**
 * Returns the active shopId, or null if no valid session exists.
 */
export async function getActiveShopId(): Promise<string | null> {
  const session = await getSession();
  return session ? session.shopId : null;
}

/**
 * Clears the session cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Hashes a 4-digit PIN using scrypt with a unique random salt.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(pin, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a 4-digit PIN against the stored scrypt hash.
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) {
      return false;
    }

    const [salt, originalHash] = parts;
    const derivedKey = scryptSync(pin, salt!, 64);
    const originalBuffer = Buffer.from(originalHash!, "hex");

    return timingSafeEqual(derivedKey, originalBuffer);
  } catch {
    return false;
  }
}
