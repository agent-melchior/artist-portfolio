"use client";

import { useEffect } from "react";

export default function GalleryMotion() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".galleryShell");
    if (!shell) return;

    const normalizeWheelDelta = (event: WheelEvent) => {
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 32
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const delta = event.deltaY * unit * 2.8;
      const maxStep = window.innerWidth * 0.9;

      return Math.max(-maxStep, Math.min(maxStep, delta));
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      shell.scrollBy({ left: normalizeWheelDelta(event), behavior: "smooth" });
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
