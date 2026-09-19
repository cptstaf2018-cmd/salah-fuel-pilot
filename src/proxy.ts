import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // camera=(self) — not camera=(). The station screen reads a citizen's QR from
  // the operator's phone, and an empty allowlist denies the camera to this
  // origin too, so getUserMedia fails before the permission prompt appears.
  // The microphone and location stay denied outright; nothing here uses them.
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
