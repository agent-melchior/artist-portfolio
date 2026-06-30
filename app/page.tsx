import { Gallery, Menu } from "./components";
import { getSiteData } from "@/lib/site-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getSiteData();
  const publicWorks = data.works.filter((work) => !work.hidden);

  return (
    <>
      <Menu items={data.menu} />
      <Gallery works={publicWorks} />
    </>
  );
}
