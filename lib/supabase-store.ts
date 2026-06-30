import { createClient } from "@supabase/supabase-js";
import type { MenuItem, SiteData, Work } from "./site-store";

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("your-project.supabase.co") ||
    normalized.includes("your-service-role-key")
  );
}

export const hasSupabaseConfig = !isPlaceholder(supabaseUrl) && !isPlaceholder(serviceRoleKey);

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toPostgrestIn(values: string[]) {
  return `(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",")})`;
}

async function deleteRowsNotIn(table: "menu_items" | "pages" | "works", column: "id" | "slug", values: string[]) {
  const supabase = getSupabaseAdmin();
  if (!values.length) {
    const { error } = await supabase.from(table).delete().neq(column, "__never__");
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(table).delete().not(column, "in", toPostgrestIn(values));
  if (error) throw error;
}

function isHiddenColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return message.toLowerCase().includes("hidden");
}

async function getWorksWithHiddenFallback() {
  const supabase = getSupabaseAdmin();
  const withHidden = await supabase
    .from("works")
    .select("id,category,title,year,material,description,image,hidden,sort_order")
    .order("sort_order");

  if (!withHidden.error) {
    return {
      works: (withHidden.data || []).map((work) => ({
        ...work,
        hidden: Boolean(work.hidden),
      })),
      hasHiddenColumn: true,
    };
  }
  if (!isHiddenColumnError(withHidden.error)) throw withHidden.error;

  const withoutHidden = await supabase
    .from("works")
    .select("id,category,title,year,material,description,image,sort_order")
    .order("sort_order");
  if (withoutHidden.error) throw withoutHidden.error;

  return {
    works: (withoutHidden.data || []).map((work) => ({
      ...work,
      hidden: false,
    })),
    hasHiddenColumn: false,
  };
}

export async function getSiteDataFromSupabase(): Promise<SiteData> {
  const supabase = getSupabaseAdmin();
  const worksResultPromise = getWorksWithHiddenFallback();

  const [{ data: settings, error: settingsError }, { data: menu, error: menuError }, { data: pages, error: pagesError }, { works }] = await Promise.all([
    supabase.from("site_settings").select("key,value"),
    supabase.from("menu_items").select("id,label,slug,type,sort_order").order("sort_order"),
    supabase.from("pages").select("slug,title,body"),
    worksResultPromise,
  ]);
  if (settingsError) throw settingsError;
  if (menuError) throw menuError;
  if (pagesError) throw pagesError;

  const siteTitle = settings?.find((row) => row.key === "siteTitle")?.value || "Artist Portfolio";
  const revision = Number.parseInt(settings?.find((row) => row.key === "dataRevision")?.value || "0", 10) || 0;

  return {
    revision,
    siteTitle,
    menu: (menu || []).map((item) => ({
      id: item.id,
      label: item.label,
      slug: item.slug,
      type: item.type,
      sort: item.sort_order,
    })) as MenuItem[],
    pages: Object.fromEntries((pages || []).map((page) => [page.slug, { title: page.title, body: page.body || "" }])),
    works: (works || []).map((work) => ({
      id: work.id,
      category: work.category,
      title: work.title,
      year: work.year || "",
      material: work.material || "",
      description: work.description || "",
      image: work.image || "",
      hidden: Boolean(work.hidden),
      sort: work.sort_order,
    })) as Work[],
  };
}

export async function saveSiteDataToSupabase(data: SiteData) {
  const supabase = getSupabaseAdmin();

  const settingsRows = [
    { key: "siteTitle", value: data.siteTitle },
    { key: "dataRevision", value: String(data.revision || 0) },
  ];
  const { error: settingsError } = await supabase.from("site_settings").upsert(settingsRows, { onConflict: "key" });
  if (settingsError) throw settingsError;

  const menuRows = data.menu.map((item, index) => ({
    id: item.id,
    label: item.label,
    slug: item.slug,
    type: item.type,
    sort_order: index,
  }));
  if (menuRows.length) {
    const { error } = await supabase.from("menu_items").upsert(menuRows, { onConflict: "id" });
    if (error) throw error;
  }
  await deleteRowsNotIn("menu_items", "id", menuRows.map((row) => row.id));

  const pageRows = Object.entries(data.pages).map(([slug, page]) => ({
    slug,
    title: page.title,
    body: page.body,
  }));
  if (pageRows.length) {
    const { error } = await supabase.from("pages").upsert(pageRows, { onConflict: "slug" });
    if (error) throw error;
  }
  await deleteRowsNotIn("pages", "slug", pageRows.map((row) => row.slug));

  const worksRows = data.works.map((work, index) => ({
    id: work.id,
    category: work.category,
    title: work.title,
    year: work.year,
    material: work.material,
    description: work.description,
    image: work.image,
    hidden: Boolean(work.hidden),
    sort_order: index,
  }));

  if (worksRows.length) {
    const withHidden = await supabase.from("works").upsert(worksRows, { onConflict: "id" });
    if (withHidden.error && isHiddenColumnError(withHidden.error)) {
      const withoutHiddenRows = worksRows.map(({ hidden: _hidden, ...rest }) => rest);
      const { error } = await supabase.from("works").upsert(withoutHiddenRows, { onConflict: "id" });
      if (error) throw error;
    } else if (withHidden.error) {
      throw withHidden.error;
    }
  }
  await deleteRowsNotIn("works", "id", worksRows.map((row) => row.id));
}

export async function uploadImageToSupabase(file: File) {
  const supabase = getSupabaseAdmin();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "portfolio-images";
  const extension = file.name.split(".").pop() || "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const path = `works/${safeName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
