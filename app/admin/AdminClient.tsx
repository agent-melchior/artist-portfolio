"use client";

import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import type { MenuItem, SiteData, Work } from "@/lib/site-store";

type AdminTab = "works" | "add" | "layout";
type WorkSort = "manual" | "year" | "title";
type WorkVisibility = "all" | "public" | "hidden";
type DropPosition = "before" | "after";
type NewWorkForm = Omit<Work, "id" | "sort">;

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10));
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const createNewWork = (category: string): NewWorkForm => ({
  category,
  title: "Untitled",
  year: new Date().getFullYear().toString(),
  material: "",
  description: "",
  image: "",
  hidden: false,
});

function normalizeData(data: SiteData): SiteData {
  return {
    ...data,
    revision: Number.isFinite(data.revision) ? data.revision : 0,
    menu: data.menu.map((item, index) => ({ ...item, sort: index })),
    works: data.works.map((work, index) => ({ ...work, sort: index, hidden: Boolean(work.hidden) })),
  };
}

function serializeData(data: SiteData) {
  return JSON.stringify(normalizeData(data));
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function Thumbnail({ work }: { work: Pick<Work, "image" | "title"> }) {
  return (
    <div className="adminThumb">
      {work.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={work.image} alt="" />
      ) : (
        <span>No image</span>
      )}
    </div>
  );
}

export default function AdminClient({ initialData }: { initialData: SiteData }) {
  const initial = useMemo(() => normalizeData(initialData), [initialData]);
  const [data, setData] = useState(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeData(initial));
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("works");
  const [workSort, setWorkSort] = useState<WorkSort>("manual");
  const [visibility, setVisibility] = useState<WorkVisibility>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [draggedWorkId, setDraggedWorkId] = useState<string | null>(null);
  const [workDropPreview, setWorkDropPreview] = useState<{ targetWorkId: string; position: DropPosition } | null>(null);
  const [savingMessage, setSavingMessage] = useState("");
  const [savingError, setSavingError] = useState("");
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [refreshingFromServer, setRefreshingFromServer] = useState(false);
  const categories = useMemo(() => data.menu.filter((item) => item.type === "category"), [data.menu]);
  const [newWork, setNewWork] = useState<NewWorkForm>(() => createNewWork(initial.menu.find((item) => item.type === "category")?.slug ?? "prototypes"));

  const isDirty = useMemo(() => serializeData(data) !== savedSnapshot, [data, savedSnapshot]);
  const selectedWork = data.works.find((work) => work.id === selectedWorkId);
  const draggedWork = data.works.find((work) => work.id === draggedWorkId);
  const sortedWorks = useMemo(() => {
    const works = [...data.works];
    if (workSort === "title") return works.sort((a, b) => a.title.localeCompare(b.title));
    if (workSort === "year") {
      return works.sort((a, b) => {
        const yearDifference = (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0);
        return yearDifference || a.title.localeCompare(b.title);
      });
    }
    return works;
  }, [data.works, workSort]);

  const filteredWorks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortedWorks.filter((work) => {
      if (visibility === "public" && work.hidden) return false;
      if (visibility === "hidden" && !work.hidden) return false;
      if (categoryFilter !== "all" && work.category !== categoryFilter) return false;
      if (!query) return true;
      return [work.title, work.year, work.material, work.description, work.category].join(" ").toLowerCase().includes(query);
    });
  }, [categoryFilter, searchQuery, sortedWorks, visibility]);

  const dragFeedback = useMemo(() => {
    if (!draggedWork) return "Drag rows to reorder, or use Up/Down for precise moves.";
    if (!workDropPreview) return `Dragging "${draggedWork.title || "Untitled"}"...`;
    const target = data.works.find((work) => work.id === workDropPreview.targetWorkId);
    if (!target) return `Dragging "${draggedWork.title || "Untitled"}"...`;
    const targetTitle = target.title || "Untitled";
    return workDropPreview.position === "before"
      ? `Release to place before "${targetTitle}".`
      : `Release to place after "${targetTitle}".`;
  }, [data.works, draggedWork, workDropPreview]);

  useEffect(() => {
    if (!categories.length) return;
    if (categories.some((category) => category.slug === newWork.category)) return;
    setNewWork((current) => ({ ...current, category: categories[0].slug }));
  }, [categories, newWork.category]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [isDirty]);

  async function refreshFromServer() {
    setRefreshingFromServer(true);
    setSavingError("");
    try {
      const response = await fetch("/api/admin/data");
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Could not load latest content.");
      const latest = normalizeData(result as SiteData);
      setData(latest);
      setSavedSnapshot(serializeData(latest));
      setHasConflict(false);
      setSavingMessage("Loaded latest content.");
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : "Could not load latest content.");
    } finally {
      setRefreshingFromServer(false);
    }
  }

  async function save(next = data, options?: { autosave?: boolean }) {
    setSaving(true);
    setSavingError("");
    setSavingMessage(options?.autosave ? "Autosaving..." : "Saving...");
    try {
      const payload = normalizeData(next);
      const response = await fetch("/api/admin/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setHasConflict(true);
        }
        throw new Error(typeof result?.error === "string" ? result.error : "Save failed.");
      }

      const persisted = normalizeData((result?.data as SiteData | undefined) ?? { ...payload, revision: payload.revision + 1 });
      setData(persisted);
      setSavedSnapshot(serializeData(persisted));
      setHasConflict(false);
      setSavingMessage(options?.autosave ? "Autosaved." : "Changes saved.");
      return true;
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : "Save failed.");
      setSavingMessage("");
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void save();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || saving || hasConflict) return;
    const timer = window.setTimeout(() => {
      void save(data, { autosave: true });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, data, hasConflict, isDirty, saving]);

  function updateMenu(id: string, patch: Partial<MenuItem>) {
    setData((current) => ({ ...current, menu: current.menu.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function updateWork(id: string, patch: Partial<Work>) {
    setData((current) => ({ ...current, works: current.works.map((work) => work.id === id ? { ...work, ...patch } : work) }));
  }

  async function uploadFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("File is too large. Max size is 8MB.");
    }
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const isOversized = bitmap.width > 8000 || bitmap.height > 8000;
      bitmap.close();
      if (isOversized) {
        throw new Error("Image dimensions are too large.");
      }
    }

    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(typeof result?.error === "string" ? result.error : "Upload failed.");
    }
    return typeof result.url === "string" ? result.url : "";
  }

  async function uploadToWork(file: File, workId: string) {
    setUploadingTarget(workId);
    setSavingError("");
    try {
      const url = await uploadFile(file);
      if (url) {
        updateWork(workId, { image: url });
        setSavingMessage("Image uploaded.");
      }
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingTarget(null);
    }
  }

  async function uploadToNewWork(file: File) {
    setUploadingTarget("new");
    setSavingError("");
    try {
      const url = await uploadFile(file);
      if (url) {
        setNewWork((current) => ({ ...current, image: url }));
        setSavingMessage("Image uploaded.");
      }
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingTarget(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/admin/login");
  }

  function addWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = uid();
    const category = newWork.category || categories[0]?.slug || "prototypes";
    setData((current) => ({
      ...current,
      works: [...current.works, { ...newWork, id, category, hidden: Boolean(newWork.hidden), sort: current.works.length }],
    }));
    setNewWork(createNewWork(category));
    setSelectedWorkId(id);
    setActiveTab("works");
  }

  function deleteWork(id: string) {
    setData((current) => ({ ...current, works: current.works.filter((entry) => entry.id !== id) }));
    setSelectedWorkId(null);
  }

  function duplicateWork(id: string) {
    const duplicateId = uid();
    setData((current) => {
      const index = current.works.findIndex((work) => work.id === id);
      if (index < 0) return current;
      const source = current.works[index];
      const copy: Work = {
        ...source,
        id: duplicateId,
        title: `${source.title || "Untitled"} (copy)`,
        sort: index + 1,
      };
      const works = [...current.works];
      works.splice(index + 1, 0, copy);
      return { ...current, works: works.map((work, position) => ({ ...work, sort: position })) };
    });
    setSelectedWorkId(duplicateId);
  }

  function clearWorkDragState() {
    setDraggedWorkId(null);
    setWorkDropPreview(null);
  }

  function getDropPosition(event: DragEvent<HTMLDivElement>): DropPosition {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  function startWorkDrag(event: DragEvent<HTMLDivElement>, workId: string) {
    setDraggedWorkId(workId);
    setWorkDropPreview(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", workId);
  }

  function handleWorkDragOver(event: DragEvent<HTMLDivElement>, targetWorkId: string) {
    event.preventDefault();
    if (!draggedWorkId || draggedWorkId === targetWorkId) return;
    const position = getDropPosition(event);
    setWorkDropPreview((current) => {
      if (current?.targetWorkId === targetWorkId && current.position === position) return current;
      return { targetWorkId, position };
    });
    event.dataTransfer.dropEffect = "move";
  }

  function handleWorkDragLeave(event: DragEvent<HTMLDivElement>, targetWorkId: string) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setWorkDropPreview((current) => current?.targetWorkId === targetWorkId ? null : current);
  }

  function dropWork(event: DragEvent<HTMLDivElement>, targetWorkId: string) {
    event.preventDefault();
    const sourceWorkId = event.dataTransfer.getData("text/plain") || draggedWorkId;
    const dropPosition = workDropPreview?.targetWorkId === targetWorkId ? workDropPreview.position : getDropPosition(event);
    clearWorkDragState();
    if (!sourceWorkId || sourceWorkId === targetWorkId) return;

    setData((current) => {
      const sourceIndex = current.works.findIndex((work) => work.id === sourceWorkId);
      if (sourceIndex < 0) return current;

      const nextWorks = [...current.works];
      const [sourceWork] = nextWorks.splice(sourceIndex, 1);
      const targetIndex = nextWorks.findIndex((work) => work.id === targetWorkId);
      if (targetIndex < 0) return current;
      const insertIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;
      nextWorks.splice(insertIndex, 0, sourceWork);
      return { ...current, works: nextWorks.map((work, index) => ({ ...work, sort: index })) };
    });
  }

  return (
    <main className="adminBody">
      <div className="adminTopbar">
        <div>
          <p className="eyebrow">Portfolio admin</p>
          <h1>Content manager</h1>
          <p className="adminMeta">{isDirty ? "Unsaved changes" : "All changes saved"} · Revision {data.revision}</p>
        </div>
        <div className="smallActions">
          <a href="/" target="_blank" rel="noreferrer">View site</a>
          <button type="button" onClick={() => setAutoSaveEnabled((current) => !current)}>
            {autoSaveEnabled ? "Autosave on" : "Autosave off"}
          </button>
          <button type="button" onClick={() => save()} disabled={saving || !isDirty}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </div>

      {!!savingMessage && <p className="adminAlert">{savingMessage}</p>}
      {!!savingError && <p className="adminAlert isError">{savingError}</p>}
      {hasConflict && (
        <div className="adminAlert isError hasAction">
          <span>Your content changed in another session. Reload latest content before saving again.</span>
          <button type="button" onClick={refreshFromServer} disabled={refreshingFromServer}>
            {refreshingFromServer ? "Loading..." : "Reload latest"}
          </button>
        </div>
      )}

      <div className="adminTabs" role="tablist" aria-label="Admin sections">
        {[
          ["works", "Works"],
          ["add", "Add New Work"],
          ["layout", "Layout"],
        ].map(([id, label]) => (
          <button
            aria-selected={activeTab === id}
            className={activeTab === id ? "isActive" : ""}
            key={id}
            onClick={() => setActiveTab(id as AdminTab)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "works" && (
        <section className="panel adminSection">
          <div className="sectionHeader">
            <div>
              <h2>Works</h2>
              <p>{filteredWorks.length} shown · {data.works.length} total</p>
            </div>
            <label className="inlineControl">Sort
              <select value={workSort} onChange={(event) => setWorkSort(event.target.value as WorkSort)}>
                <option value="manual">Manual order</option>
                <option value="year">Year, newest first</option>
                <option value="title">Alphabetical</option>
              </select>
            </label>
          </div>

          <div className="adminFilters">
            <label>Search
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Title, year, material..." />
            </label>
            <label>Visibility
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as WorkVisibility)}>
                <option value="all">All entries</option>
                <option value="public">Public only</option>
                <option value="hidden">Hidden only</option>
              </select>
            </label>
            <label>Category
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => <option value={category.slug} key={category.id}>{category.label}</option>)}
              </select>
            </label>
          </div>

          <div className="workList">
            {filteredWorks.map((work) => (
              <button className="workListRow" key={work.id} onClick={() => setSelectedWorkId(work.id)} type="button">
                <Thumbnail work={work} />
                <span className="workListMain">
                  <strong>{work.title || "Untitled"}</strong>
                  <span>{work.year || "No year"} · {work.category}</span>
                </span>
                <span className={work.hidden ? "statusBadge isHidden" : "statusBadge"}>{work.hidden ? "Hidden" : "Public"}</span>
              </button>
            ))}
            {!filteredWorks.length && <p className="emptyState">No works match the current filters.</p>}
          </div>
        </section>
      )}

      {activeTab === "add" && (
        <section className="panel adminSection">
          <div className="sectionHeader">
            <div>
              <h2>Add New Work</h2>
              <p>Create a new entry and add it to the manual layout order.</p>
            </div>
          </div>

          <form className="editorGrid" onSubmit={addWork}>
            <div className="editorPreview">
              <Thumbnail work={newWork} />
            </div>
            <div className="editorFields">
              <div className="row">
                <label>Title<input value={newWork.title} onChange={(event) => setNewWork({ ...newWork, title: event.target.value })} /></label>
                <label>Category
                  <select value={newWork.category} onChange={(event) => setNewWork({ ...newWork, category: event.target.value })}>
                    {categories.map((category) => <option value={category.slug} key={category.id}>{category.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>Year<input value={newWork.year} onChange={(event) => setNewWork({ ...newWork, year: event.target.value })} /></label>
                <label>Material<input value={newWork.material} onChange={(event) => setNewWork({ ...newWork, material: event.target.value })} /></label>
              </div>
              <label>Image URL<input value={newWork.image} onChange={(event) => setNewWork({ ...newWork, image: event.target.value })} /></label>
              <label>Upload image<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadToNewWork(event.target.files[0])} /></label>
              {uploadingTarget === "new" && <p className="adminMeta">Uploading image...</p>}
              <label>Description<textarea value={newWork.description} onChange={(event) => setNewWork({ ...newWork, description: event.target.value })} /></label>
              <label className="checkRow"><input type="checkbox" checked={!newWork.hidden} onChange={(event) => setNewWork({ ...newWork, hidden: !event.target.checked })} />Public entry</label>
              <div className="smallActions">
                <button type="submit">Add work</button>
              </div>
            </div>
          </form>
        </section>
      )}

      {activeTab === "layout" && (
        <section className="adminLayout">
          <div className="panel adminSection">
            <div className="sectionHeader">
              <div>
                <h2>Manual work order</h2>
                <p>This order controls gallery layout and the manual sort in Works.</p>
              </div>
            </div>
            <p className={draggedWorkId ? "dragStatus isActive" : "dragStatus"}>{dragFeedback}</p>
            <div className="layoutList">
              {data.works.map((work, index) => (
                <div
                  aria-grabbed={draggedWorkId === work.id}
                  className={[
                    "layoutRow",
                    draggedWorkId === work.id ? "isDragging" : "",
                    workDropPreview?.targetWorkId === work.id && workDropPreview.position === "before" ? "isDropBefore" : "",
                    workDropPreview?.targetWorkId === work.id && workDropPreview.position === "after" ? "isDropAfter" : "",
                  ].join(" ").trim()}
                  draggable
                  key={work.id}
                  onDragEnd={clearWorkDragState}
                  onDragLeave={(event) => handleWorkDragLeave(event, work.id)}
                  onDragOver={(event) => handleWorkDragOver(event, work.id)}
                  onDragStart={(event) => startWorkDrag(event, work.id)}
                  onDrop={(event) => dropWork(event, work.id)}
                >
                  <span className="dragHandle" aria-hidden="true">⋮⋮</span>
                  <Thumbnail work={work} />
                  <div>
                    <strong>{work.title || "Untitled"}</strong>
                    <p>{work.year || "No year"} · {work.category}</p>
                  </div>
                  <div className="smallActions">
                    <button type="button" onClick={() => setData((current) => ({ ...current, works: move(current.works, index, -1) }))}>Up</button>
                    <button type="button" onClick={() => setData((current) => ({ ...current, works: move(current.works, index, 1) }))}>Down</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel adminSection">
            <div className="sectionHeader">
              <div>
                <h2>Menu / pages</h2>
                <p>Manage navigation, text pages, and work categories.</p>
              </div>
              <button type="button" onClick={() => setData((current) => ({
                ...current,
                menu: [...current.menu, { id: uid(), label: "New page", slug: `page-${uid().slice(0, 8)}`, type: "page", sort: current.menu.length }],
              }))}>Add menu item</button>
            </div>

            <label>Site title<input value={data.siteTitle} onChange={(event) => setData((current) => ({ ...current, siteTitle: event.target.value }))} /></label>
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
                    <button type="button" onClick={() => setData((current) => ({ ...current, menu: move(current.menu, index, -1) }))}>Up</button>
                    <button type="button" onClick={() => setData((current) => ({ ...current, menu: move(current.menu, index, 1) }))}>Down</button>
                    <button type="button" onClick={() => setData((current) => ({ ...current, menu: current.menu.filter((entry) => entry.id !== item.id) }))}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedWork && (
        <div className="modalOverlay" role="presentation" onMouseDown={() => setSelectedWorkId(null)}>
          <section className="workModal" aria-modal="true" role="dialog" aria-label={`Edit ${selectedWork.title}`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">{selectedWork.hidden ? "Hidden" : "Public"} work</p>
                <h2>Edit work</h2>
              </div>
              <button type="button" onClick={() => setSelectedWorkId(null)}>Close</button>
            </div>

            <div className="editorGrid">
              <div className="editorPreview">
                <Thumbnail work={selectedWork} />
              </div>
              <div className="editorFields">
                <div className="row">
                  <label>Title<input value={selectedWork.title} onChange={(event) => updateWork(selectedWork.id, { title: event.target.value })} /></label>
                  <label>Category
                    <select value={selectedWork.category} onChange={(event) => updateWork(selectedWork.id, { category: event.target.value })}>
                      {categories.map((category) => <option value={category.slug} key={category.id}>{category.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="row">
                  <label>Year<input value={selectedWork.year} onChange={(event) => updateWork(selectedWork.id, { year: event.target.value })} /></label>
                  <label>Material<input value={selectedWork.material} onChange={(event) => updateWork(selectedWork.id, { material: event.target.value })} /></label>
                </div>
                <label>Image URL<input value={selectedWork.image} onChange={(event) => updateWork(selectedWork.id, { image: event.target.value })} /></label>
                <label>Upload image<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadToWork(event.target.files[0], selectedWork.id)} /></label>
                {uploadingTarget === selectedWork.id && <p className="adminMeta">Uploading image...</p>}
                <label>Description<textarea value={selectedWork.description} onChange={(event) => updateWork(selectedWork.id, { description: event.target.value })} /></label>
                <label className="checkRow"><input type="checkbox" checked={!selectedWork.hidden} onChange={(event) => updateWork(selectedWork.id, { hidden: !event.target.checked })} />Public entry</label>
                <div className="smallActions">
                  <button type="button" onClick={() => duplicateWork(selectedWork.id)}>Duplicate work</button>
                  <button type="button" onClick={() => deleteWork(selectedWork.id)}>Delete work</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
