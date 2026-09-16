import { describe, expect, it } from "vitest";
import { maskPhone } from "@/lib/format";

describe("maskPhone", () => {
  it("masks phone numbers while preserving enough context for operators", () => {
    expect(maskPhone("+9647701234567")).toBe("+96****567");
  });
});
