import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { getSessionCookieName } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = await login(request);
  if (response.ok) {
    const data = await response.clone().json();
    const cookie = response.cookies.get(getSessionCookieName());
    if (cookie && ["SUPER_ADMIN", "STATION_MANAGER"].includes(data.user.role)) {
      response.cookies.set({ ...cookie, name: `${getSessionCookieName()}_${data.user.role === "SUPER_ADMIN" ? "admin" : "station"}` });
    }
  }
  return response;
}
