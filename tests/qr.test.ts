import { describe, expect, it } from "vitest";
import { createVehicleQrSecret, hashQrSecret, parseVehicleQrPayload } from "@/lib/qr";

describe("vehicle qr tokens", () => {
  it("creates an opaque qr payload with no vehicle or owner data", () => {
    const qr = createVehicleQrSecret();

    expect(qr.payload).toContain("salah-fuel:v1");
    expect(qr.payload).toContain(qr.publicId);
    expect(qr.payload).toContain(qr.secret);
    expect(qr.payload).not.toContain("plate");
    expect(qr.payload).not.toContain("phone");
  });

  it("parses valid payloads and rejects malformed payloads", () => {
    const qr = createVehicleQrSecret();

    expect(parseVehicleQrPayload(qr.payload)).toEqual({
      publicId: qr.publicId,
      secret: qr.secret
    });
    expect(parseVehicleQrPayload("bad-payload")).toBeNull();
  });

  it("hashes only the secret before persistence", () => {
    const qr = createVehicleQrSecret();
    const hash = hashQrSecret(qr.secret);

    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(qr.secret);
  });
});
