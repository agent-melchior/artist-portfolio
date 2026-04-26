import { Gallery, Menu } from "./components";
import { getSiteData } from "@/lib/site-store";

export default async function Home() {
  const data = await getSiteData();
  const firstCategory = data.menu.find((item) => item.type === "category")?.slug;
  const works = firstCategory ? data.works.filter((work) => work.category === firstCategory) : data.works;

  return (
    <>
      <Menu items={data.menu} />
      <Gallery works={works} />
    </>
  );
}
