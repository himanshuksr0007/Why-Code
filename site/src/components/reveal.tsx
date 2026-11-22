"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades and lifts its children into place the first time they scroll into
 * view. Children of a `.stagger` element inside animate one after another.
 * Reduced motion shows everything immediately (handled in globals.css).
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${shown ? "is-shown" : ""} ${className}`}>
      {children}
    </div>
  );
}
