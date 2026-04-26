import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";

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
  sort: number;
};

export type SiteData = {
  siteTitle: string;
  menu: MenuItem[];
  pages: Record<string, { title: string; body: string }>;
  works: Work[];
};

const dataPath = path.join(process.cwd(), "data", "site.json");

export async function getSiteData(): Promise<SiteData> {
  const file = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(file) as SiteData;
  return {
    ...data,
    menu: [...data.menu].sort((a, b) => a.sort - b.sort),
    works: [...data.works].sort((a, b) => a.sort - b.sort),
  };
}

export async function saveSiteData(data: SiteData) {
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
  return cookieStore.get("portfolio_admin")?.value === "yes";
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}
