import { NextResponse } from "next/server";
import { getSiteData, isAdmin, saveSiteData, type SiteData } from "@/lib/site-store";
import { safeParseSiteDataPayload } from "@/lib/admin-schemas";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

function getContentLength(request: Request) {
  const value = request.headers.get("content-length");
  const size = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(size) ? size : 0;
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: string; details?: string; hint?: string };
    return candidate.message || candidate.details || candidate.hint || "Unexpected error.";
  }
  return "Unexpected error.";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getSiteData());
  } catch (error) {
    console.error("Failed to load site data:", error);
    return NextResponse.json({ error: `Could not load content: ${describeError(error)}` }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getContentLength(request) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = safeParseSiteDataPayload(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid content payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const currentData = await getSiteData();
    if (parsed.data.revision !== currentData.revision) {
      return NextResponse.json(
        {
          error: "Content changed in another session. Reload and retry.",
          currentRevision: currentData.revision,
        },
        { status: 409 },
      );
    }

    const nextData: SiteData = {
      ...parsed.data,
      revision: currentData.revision + 1,
    };
    await saveSiteData(nextData);
    return NextResponse.json({ ok: true, revision: nextData.revision, data: nextData });
  } catch (error) {
    console.error("Failed to save site data:", error);
    return NextResponse.json(
      { error: `Could not save content: ${describeError(error)}` },
      { status: 500 },
    );
  }
}
