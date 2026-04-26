import { NextResponse } from "next/server";
import { getSiteData, isAdmin, saveSiteData, type SiteData } from "@/lib/site-store";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getSiteData());
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = (await request.json()) as SiteData;
  data.menu = data.menu.map((item, index) => ({ ...item, sort: index }));
  data.works = data.works.map((work, index) => ({ ...work, sort: index }));
  await saveSiteData(data);
  return NextResponse.json({ ok: true });
}
