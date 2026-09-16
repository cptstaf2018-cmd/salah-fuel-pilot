import crypto from "node:crypto";

const sessionCookieName = "salah_fuel_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

export type SessionPayload = {
  sessionId: string;
  userId: string;
  role: string;
  expiresAt: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }

  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "expiresAt">): string {
  const body: SessionPayload = {
    ...payload,
    expiresAt: Date.now() + sessionDurationMs
  };
  const encoded = base64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded);
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (
    signatureBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(signatureBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getSessionCookieName(): string {
  return sessionCookieName;
}

export function getSessionExpiration(): Date {
  return new Date(Date.now() + sessionDurationMs);
}
