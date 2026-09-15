import { NextResponse, type NextRequest } from "next/server";
import { requestUserId } from "./app/lib/identity";

export function middleware(request: NextRequest) {
  if (!requestUserId(request, import.meta.env.DEV)) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
