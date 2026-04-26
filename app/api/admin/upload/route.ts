import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isAdmin } from "@/lib/site-store";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/${safeName}` });
}
