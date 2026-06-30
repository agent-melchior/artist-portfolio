import { z } from "zod";
import type { SiteData } from "./site-store";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const menuItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).regex(slugRegex),
  type: z.enum(["page", "category"]),
  sort: z.number().int().nonnegative(),
});

const pageSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().max(20000),
});

const workSchema = z.object({
  id: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120).regex(slugRegex),
  title: z.string().trim().min(1).max(200),
  year: z.string().trim().max(16),
  material: z.string().trim().max(160),
  description: z.string().max(4000),
  image: z.string().trim().max(2000),
  hidden: z.boolean().optional(),
  sort: z.number().int().nonnegative(),
});

const siteDataSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    siteTitle: z.string().trim().min(1).max(120),
    menu: z.array(menuItemSchema).max(100),
    pages: z.record(z.string().regex(slugRegex), pageSchema),
    works: z.array(workSchema).max(2000),
  })
  .superRefine((data, context) => {
    const menuIds = new Set<string>();
    const menuSlugs = new Set<string>();
    for (const item of data.menu) {
      if (menuIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate menu id: ${item.id}`,
          path: ["menu"],
        });
      }
      menuIds.add(item.id);

      if (menuSlugs.has(item.slug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate menu slug: ${item.slug}`,
          path: ["menu"],
        });
      }
      menuSlugs.add(item.slug);
    }

    const categorySlugs = new Set(data.menu.filter((item) => item.type === "category").map((item) => item.slug));
    const workIds = new Set<string>();
    for (const work of data.works) {
      if (!categorySlugs.has(work.category)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown work category: ${work.category}`,
          path: ["works"],
        });
      }
      if (workIds.has(work.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate work id: ${work.id}`,
          path: ["works"],
        });
      }
      workIds.add(work.id);
    }
  });

export function safeParseSiteDataPayload(payload: unknown) {
  const parsed = siteDataSchema.safeParse(payload);
  if (!parsed.success) return parsed;

  return {
    success: true as const,
    data: {
      ...parsed.data,
      menu: parsed.data.menu.map((item, index) => ({ ...item, sort: index })),
      works: parsed.data.works.map((work, index) => ({ ...work, sort: index, hidden: Boolean(work.hidden) })),
    } satisfies SiteData,
  };
}
