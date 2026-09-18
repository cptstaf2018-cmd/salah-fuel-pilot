import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { getSessionCookieName } from "@/lib/auth/session";

/**
 * The pilot dashboards sign in through the ordinary login route.
 *
 * This used to copy the session cookie into a second, role-suffixed cookie so
 * an admin and a station manager could be signed in side by side in one
 * browser. That convenience was the whole attack: logout only cleared the base
 * cookie, so the copy outlived the session it came from, and a request could
 * ask for it by name. The copies are now cleared rather than created.
 */
export async function POST(request: NextRequest) {
  const response = await login(request);

  for (const scope of ["admin", "station"]) {
    response.cookies.set({
      name: `${getSessionCookieName()}_${scope}`,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
  }

  return response;
}
