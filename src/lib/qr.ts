import crypto from "node:crypto";
import QRCode from "qrcode";

const qrPrefix = "salah-fuel:v1";

export type VehicleQrSecret = {
  publicId: string;
  secret: string;
  payload: string;
};

export function createVehicleQrSecret(): VehicleQrSecret {
  const publicId = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("base64url");

  return {
    publicId,
    secret,
    payload: `${qrPrefix}:${publicId}:${secret}`
  };
}

export function parseVehicleQrPayload(payload: string): { publicId: string; secret: string } | null {
  const parts = payload.split(":");

  if (parts.length !== 4 || `${parts[0]}:${parts[1]}` !== qrPrefix) {
    return null;
  }

  const [, , publicId, secret] = parts;

  if (!publicId || !secret) {
    return null;
  }

  return { publicId, secret };
}

export function hashQrSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {
      dark: "#123f2b",
      light: "#ffffff"
    }
  });
}
