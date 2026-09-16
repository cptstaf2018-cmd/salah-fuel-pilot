import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "salah-al-din-smart-fuel",
    status: "ok",
    phase: "PHASE_1_FOUNDATION"
  });
}
