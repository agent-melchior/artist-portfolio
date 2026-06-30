import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "./admin-auth";
import {
  getSiteDataFromSupabase,
  hasSupabaseConfig,
  saveSiteDataToSupabase,
} from "./supabase-store";

export type MenuItem = {
  id: string;
  label: string;
  slug: string;
  type: "page" | "category";
  sort: number;
};

export type Work = {
  id: string;
  category: string;
  title: string;
  year: string;
  material: string;
  description: string;
  image: string;
  hidden?: boolean;
  sort: number;
};

export type SiteData = {
  revision: number;
  siteTitle: string;
  menu: MenuItem[];
  pages: Record<string, { title: string; body: string }>;
  works: Work[];
};

const dataPath = path.join(process.cwd(), "data", "site.json");

async function readLocalSiteData(): Promise<SiteData> {
  const file = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(file) as SiteData;
  return {
    ...data,
    revision: Number.isFinite(data.revision) ? data.revision : 0,
    menu: [...data.menu].sort((a, b) => a.sort - b.sort),
    works: [...data.works].sort((a, b) => a.sort - b.sort),
  };
}

export async function getSiteData(): Promise<SiteData> {
  // When Supabase is configured it is the single source of truth. We never fall
  // back to the local data/site.json so the frontend only ever shows content
  // that lives in the online database.
  if (hasSupabaseConfig) {
    return getSiteDataFromSupabase();
  }

  return readLocalSiteData();
}

export async function saveSiteData(data: SiteData) {
  if (hasSupabaseConfig) {
    await saveSiteDataToSupabase(data);
    return;
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return token ? verifyAdminSessionToken(token) : false;
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}
