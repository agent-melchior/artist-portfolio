"use client";

import { useEffect } from "react";

export default function GalleryMotion() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".galleryShell");
    if (!shell) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      shell.scrollBy({ left: event.deltaY, behavior: "smooth" });
    };

    shell.addEventListener("wheel", onWheel, { passive: false });

    const cards = Array.from(document.querySelectorAll<HTMLElement>(".workCard.fogIn"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("isVisible");
        });
      },
      { root: shell, threshold: 0.18, rootMargin: "0px -8% 0px -8%" }
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      shell.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, []);

  return null;
}
