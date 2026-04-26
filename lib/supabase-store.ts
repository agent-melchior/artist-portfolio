import { createClient } from "@supabase/supabase-js";
import type { MenuItem, SiteData, Work } from "./site-store";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && serviceRoleKey);

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getSiteDataFromSupabase(): Promise<SiteData> {
  const supabase = getSupabaseAdmin();

  const [{ data: settings }, { data: menu }, { data: pages }, { data: works }] = await Promise.all([
    supabase.from("site_settings").select("key,value"),
    supabase.from("menu_items").select("id,label,slug,type,sort_order").order("sort_order"),
    supabase.from("pages").select("slug,title,body"),
    supabase.from("works").select("id,category,title,year,material,description,image,sort_order").order("sort_order"),
  ]);

  const siteTitle = settings?.find((row) => row.key === "siteTitle")?.value || "Artist Portfolio";

  return {
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
      sort: work.sort_order,
    })) as Work[],
  };
}

export async function saveSiteDataToSupabase(data: SiteData) {
  const supabase = getSupabaseAdmin();

  await supabase.from("site_settings").upsert({ key: "siteTitle", value: data.siteTitle }, { onConflict: "key" });

  await supabase.from("menu_items").delete().neq("id", "__never__");
  if (data.menu.length) {
    const { error } = await supabase.from("menu_items").insert(data.menu.map((item, index) => ({
      id: item.id,
      label: item.label,
      slug: item.slug,
      type: item.type,
      sort_order: index,
    })));
    if (error) throw error;
  }

  await supabase.from("pages").delete().neq("slug", "__never__");
  const pageRows = Object.entries(data.pages).map(([slug, page]) => ({ slug, title: page.title, body: page.body }));
  if (pageRows.length) {
    const { error } = await supabase.from("pages").insert(pageRows);
    if (error) throw error;
  }

  await supabase.from("works").delete().neq("id", "__never__");
  if (data.works.length) {
    const { error } = await supabase.from("works").insert(data.works.map((work, index) => ({
      id: work.id,
      category: work.category,
      title: work.title,
      year: work.year,
      material: work.material,
      description: work.description,
      image: work.image,
      sort_order: index,
    })));
    if (error) throw error;
  }
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
