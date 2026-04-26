import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.ADMIN_PASSWORD || "admin";

  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("portfolio_admin", "yes", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
