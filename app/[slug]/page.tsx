import { notFound } from "next/navigation";
import { Gallery, Menu, TextPage } from "../components";
import { getSiteData } from "@/lib/site-store";

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getSiteData();
  const item = data.menu.find((entry) => entry.slug === slug);

  if (!item) notFound();

  if (item.type === "page") {
    const page = data.pages[slug] ?? { title: item.label, body: "" };
    return (
      <>
        <Menu items={data.menu} />
        <TextPage title={page.title} body={page.body} />
      </>
    );
  }

  return (
    <>
      <Menu items={data.menu} />
      <Gallery works={data.works.filter((work) => work.category === slug)} />
    </>
  );
}
