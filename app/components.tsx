import Link from "next/link";
import type { MenuItem, Work } from "@/lib/site-store";
import GalleryMotion from "./GalleryMotion";

export function Menu({ items }: { items: MenuItem[] }) {
  return (
    <nav className="menu" aria-label="Main navigation">
      <Link className="brand" href="/">Index</Link>
      <div className="menuItems">
        {items.map((item) => (
          <Link key={item.id} href={`/${item.slug}`}>{item.label}</Link>
        ))}
      </div>
    </nav>
  );
}

export function Gallery({ works }: { works: Work[] }) {
  return (
    <main className="galleryShell">
      <GalleryMotion />
      <section className="horizontalGallery" aria-label="Works">
        {works.map((work, index) => (
          <article className="workCard fogIn" style={{ ["--delay" as string]: `${index * 90}ms` }} key={work.id}>
            <div className="imageFrame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={work.image} alt={work.title} />
            </div>
            <div className="workText">
              <h2>{work.title}</h2>
              <p className="meta">{work.year} · {work.material}</p>
              <p>{work.description}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export function TextPage({ title, body }: { title: string; body: string }) {
  return (
    <main className="textPage fogIn">
      <h1>{title}</h1>
      {body.split("\n").map((line, index) => (
        <p key={`${line}-${index}`}>{line || "\u00a0"}</p>
      ))}
    </main>
  );
}
