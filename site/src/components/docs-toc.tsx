"use client";

import { useEffect, useState } from "react";

/**
 * "On this page" navigation that follows the reader: the section nearest
 * the top of the viewport is highlighted, and a bar slides to it.
 */
export function DocsToc({ items }: { items: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState(items[0]?.[0] ?? "");

  useEffect(() => {
    const sections = items
      .map(([href]) => document.querySelector<HTMLElement>(href))
      .filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0) return;

    // The active section is the last one whose top has scrolled past a line
    // just under the sticky header; at the very bottom it is the last one.
    const LINE = 140;
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0];
      for (const node of sections) {
        if (node.getBoundingClientRect().top <= LINE) current = node;
      }
      if (atBottom) current = sections[sections.length - 1];
      setActive(`#${current.id}`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  const index = Math.max(
    0,
    items.findIndex(([href]) => href === active),
  );

  return (
    <nav aria-label="On this page" className="hidden pt-24 lg:block">
      <div className="sticky top-24">
        <p className="mb-3 font-mono text-[11px] tracking-wider text-ink-faint uppercase">On this page</p>
        <div className="relative pl-4">
          <span className="absolute top-0 bottom-0 left-0 w-px bg-line" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute left-0 h-7 w-px bg-ink transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${index * 2.25}rem)` }}
          />
          <ul className="space-y-2 text-sm">
            {items.map(([href, label]) => {
              const on = href === active;
              return (
                <li key={href} className="flex h-7 items-center">
                  <a
                    href={href}
                    aria-current={on ? "location" : undefined}
                    className={`transition-colors duration-200 ${on ? "text-ink" : "text-ink-soft hover:text-ink"}`}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
