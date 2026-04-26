"use client";

import { useMemo, useState } from "react";
import type { MenuItem, SiteData, Work } from "@/lib/site-store";

const uid = () => Math.random().toString(36).slice(2, 10);
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminClient({ initialData }: { initialData: SiteData }) {
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => data.menu.filter((item) => item.type === "category"), [data.menu]);

  async function save(next = data) {
    setSaving(true);
    await fetch("/api/admin/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
  }

  function updateMenu(id: string, patch: Partial<MenuItem>) {
    setData((current) => ({ ...current, menu: current.menu.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function updateWork(id: string, patch: Partial<Work>) {
    setData((current) => ({ ...current, works: current.works.map((work) => work.id === id ? { ...work, ...patch } : work) }));
  }

  function move<T>(items: T[], index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  async function upload(file: File, workId: string) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body });
    const result = await response.json();
    if (result.url) updateWork(workId, { image: result.url });
  }

  return (
    <main className="adminBody">
      <div className="itemHeader">
        <h1>Portfolio admin</h1>
        <div className="smallActions">
          <a href="/" target="_blank">View site</a>
          <button onClick={() => save()}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      <div className="adminGrid">
        <section className="panel">
          <h2>Menu / pages</h2>
          <label>Site title<input value={data.siteTitle} onChange={(event) => setData({ ...data, siteTitle: event.target.value })} /></label>
          <button onClick={() => setData((current) => ({
            ...current,
            menu: [...current.menu, { id: uid(), label: "New page", slug: `page-${uid()}`, type: "page", sort: current.menu.length }]
          }))}>Add menu item</button>

          <div className="list">
            {data.menu.map((item, index) => (
              <div className="item" key={item.id}>
                <div className="row">
                  <label>Label<input value={item.label} onChange={(event) => updateMenu(item.id, { label: event.target.value })} /></label>
                  <label>Slug<input value={item.slug} onChange={(event) => updateMenu(item.id, { slug: slugify(event.target.value) })} /></label>
                </div>
                <label>Type
                  <select value={item.type} onChange={(event) => updateMenu(item.id, { type: event.target.value as MenuItem["type"] })}>
                    <option value="page">Text page</option>
                    <option value="category">Work category</option>
                  </select>
                </label>
                {item.type === "page" && (
                  <>
                    <label>Page title<input value={data.pages[item.slug]?.title ?? item.label} onChange={(event) => setData((current) => ({ ...current, pages: { ...current.pages, [item.slug]: { ...(current.pages[item.slug] ?? { body: "" }), title: event.target.value } } }))} /></label>
                    <label>Body<textarea value={data.pages[item.slug]?.body ?? ""} onChange={(event) => setData((current) => ({ ...current, pages: { ...current.pages, [item.slug]: { ...(current.pages[item.slug] ?? { title: item.label }), body: event.target.value } } }))} /></label>
                  </>
                )}
                <div className="smallActions">
                  <button onClick={() => setData((current) => ({ ...current, menu: move(current.menu, index, -1) }))}>↑</button>
                  <button onClick={() => setData((current) => ({ ...current, menu: move(current.menu, index, 1) }))}>↓</button>
                  <button onClick={() => setData((current) => ({ ...current, menu: current.menu.filter((entry) => entry.id !== item.id) }))}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Works</h2>
          <button onClick={() => setData((current) => ({
            ...current,
            works: [...current.works, {
              id: uid(), category: categories[0]?.slug ?? "prototypes", title: "Untitled", year: new Date().getFullYear().toString(), material: "", description: "", image: "", sort: current.works.length
            }]
          }))}>Add work</button>

          <div className="list">
            {data.works.map((work, index) => (
              <div className="item" key={work.id}>
                <div className="row">
                  <label>Title<input value={work.title} onChange={(event) => updateWork(work.id, { title: event.target.value })} /></label>
                  <label>Category<select value={work.category} onChange={(event) => updateWork(work.id, { category: event.target.value })}>{categories.map((category) => <option value={category.slug} key={category.id}>{category.label}</option>)}</select></label>
                </div>
                <div className="row">
                  <label>Year<input value={work.year} onChange={(event) => updateWork(work.id, { year: event.target.value })} /></label>
                  <label>Material<input value={work.material} onChange={(event) => updateWork(work.id, { material: event.target.value })} /></label>
                </div>
                <label>Image URL<input value={work.image} onChange={(event) => updateWork(work.id, { image: event.target.value })} /></label>
                <label>Upload image<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], work.id)} /></label>
                <label>Description<textarea value={work.description} onChange={(event) => updateWork(work.id, { description: event.target.value })} /></label>
                <div className="smallActions">
                  <button onClick={() => setData((current) => ({ ...current, works: move(current.works, index, -1) }))}>↑</button>
                  <button onClick={() => setData((current) => ({ ...current, works: move(current.works, index, 1) }))}>↓</button>
                  <button onClick={() => setData((current) => ({ ...current, works: current.works.filter((entry) => entry.id !== work.id) }))}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
