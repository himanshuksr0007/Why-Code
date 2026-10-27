"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive animated grid background with responsive cursor warping
 * - Light theme: warm cream background with crisp orangish grid
 * - Dark theme: deep espresso/obsidian background with radiant orange grid
 * - Smooth lerped cursor deformation (radial cloth-like bend)
 * - Window blur, mouseleave, and visibilitychange reset handling
 * - Zero idle CPU overhead when resting
 * - Retina/HiDPI display crispness and prefers-reduced-motion support
 */
export function GridBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Grid configuration
    const GRID_SIZE = 40;
    const RADIUS = 185;
    const MAX_STRENGTH = 26;

    // Animation state
    let rafId: number | null = null;
    let currentX = -9999;
    let currentY = -9999;
    let targetX = -9999;
    let targetY = -9999;
    let currentStrength = 0;
    let targetStrength = 0;

    // Fetch theme colors dynamically
    const getThemeColors = () => {
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        return {
          line: "rgba(245, 145, 50, 0.36)",
          glowCenter: "rgba(255, 140, 40, 0.18)",
          glowMid: "rgba(240, 120, 20, 0.05)",
          lineWidth: 1.25,
        };
      }
      return {
        line: "rgba(215, 135, 75, 0.42)",
        glowCenter: "rgba(230, 145, 70, 0.16)",
        glowMid: "rgba(220, 135, 60, 0.04)",
        lineWidth: 1.25,
      };
    };

    // Draw the entire grid
    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const colors = getThemeColors();

      // Subtle warm radial ambient glow near cursor when hovering
      if (!prefersReducedMotion && currentStrength > 0.5 && currentX > -RADIUS && currentY > -RADIUS) {
        const glow = ctx.createRadialGradient(
          currentX,
          currentY,
          0,
          currentX,
          currentY,
          RADIUS
        );
        glow.addColorStop(0, colors.glowCenter);
        glow.addColorStop(0.55, colors.glowMid);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(currentX, currentY, RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = colors.line;
      ctx.lineWidth = colors.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();

      const canWarp = !prefersReducedMotion && currentStrength > 0.05;

      // Vertical lines
      for (let x = 0; x <= w + GRID_SIZE; x += GRID_SIZE) {
        const dxFromMouse = Math.abs(x - currentX);
        if (!canWarp || dxFromMouse >= RADIUS) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        } else {
          const startY = Math.max(0, currentY - RADIUS - 10);
          const endY = Math.min(h, currentY + RADIUS + 10);

          ctx.moveTo(x, 0);
          if (startY > 0) {
            ctx.lineTo(x, startY);
          }

          const step = 8;
          for (let y = startY; y <= endY; y += step) {
            const dx = x - currentX;
            const dy = y - currentY;
            const dist = Math.hypot(dx, dy);

            if (dist < RADIUS && dist > 0.001) {
              const falloff = Math.pow(1 - dist / RADIUS, 2);
              const disp = falloff * currentStrength;
              ctx.lineTo(x + (dx / dist) * disp, y + (dy / dist) * disp);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.lineTo(x, h);
        }
      }

      // Horizontal lines
      for (let y = 0; y <= h + GRID_SIZE; y += GRID_SIZE) {
        const dyFromMouse = Math.abs(y - currentY);
        if (!canWarp || dyFromMouse >= RADIUS) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        } else {
          const startX = Math.max(0, currentX - RADIUS - 10);
          const endX = Math.min(w, currentX + RADIUS + 10);

          ctx.moveTo(0, y);
          if (startX > 0) {
            ctx.lineTo(startX, y);
          }

          const step = 8;
          for (let x = startX; x <= endX; x += step) {
            const dx = x - currentX;
            const dy = y - currentY;
            const dist = Math.hypot(dx, dy);

            if (dist < RADIUS && dist > 0.001) {
              const falloff = Math.pow(1 - dist / RADIUS, 2);
              const disp = falloff * currentStrength;
              ctx.lineTo(x + (dx / dist) * disp, y + (dy / dist) * disp);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.lineTo(w, y);
        }
      }

      ctx.stroke();
    };

    // Smooth animation tick
    const animate = () => {
      // Elastic lerping
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;
      currentStrength += (targetStrength - currentStrength) * 0.10;

      draw();

      // Pause render loop when resting and fully reset to prevent CPU/battery drain
      if (targetStrength === 0 && Math.abs(currentStrength) < 0.05) {
        currentStrength = 0;
        draw();
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(animate);
    };

    const startLoop = () => {
      if (!rafId && !prefersReducedMotion) {
        rafId = requestAnimationFrame(animate);
      }
    };

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    // Resize with Retina / high-DPI scaling
    const updateDimensions = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      draw();
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    // Track pointer movement
    const handlePointerMove = (e: PointerEvent) => {
      if (prefersReducedMotion) return;
      targetX = e.clientX;
      targetY = e.clientY;
      targetStrength = MAX_STRENGTH;
      startLoop();
    };

    // Smooth return to default when pointer leaves viewport
    const handleMouseLeave = () => {
      targetStrength = 0;
      startLoop();
    };

    // Smooth return to default when window loses focus (e.g., user Alt+Tabs)
    const handleBlur = () => {
      targetStrength = 0;
      startLoop();
    };

    // Instant reset to default when user switches browser tab or minimizes window
    const handleVisibilityChange = () => {
      if (document.hidden) {
        targetStrength = 0;
        currentStrength = 0;
        stopLoop();
        draw();
      } else {
        draw();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Re-render when theme changes (light <-> dark)
    const observer = new MutationObserver(() => {
      draw();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.removeEventListener("resize", updateDimensions);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
      stopLoop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      suppressHydrationWarning
      className={cn(
        "fixed inset-0 pointer-events-none z-0",
        className
      )}
    />
  );
}
