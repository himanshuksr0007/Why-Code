"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive grid background with cursor reaction animations
 * Grid lines bend and wave smoothly as the cursor moves near them
 */
export function GridBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let mouseX = -1000;
    let mouseY = -1000;
    const gridSize = 30;
    const influenceRadius = 150;
    const maxDisplacement = 20;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Calculate displacement based on distance from mouse
    const getDisplacement = (x: number, y: number): { dx: number; dy: number } => {
      const distX = x - mouseX;
      const distY = y - mouseY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance > influenceRadius) {
        return { dx: 0, dy: 0 };
      }

      const influence = 1 - distance / influenceRadius;
      const displacement = influence * maxDisplacement;

      const angle = Math.atan2(distY, distX);
      return {
        dx: Math.cos(angle) * displacement,
        dy: Math.sin(angle) * displacement,
      };
    };

    // Draw grid with smooth animations
    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw vertical lines
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.lineWidth = 3;

        for (let y = 0; y <= canvas.height; y += 5) {
          const displacement = getDisplacement(x, y);
          const actualX = x + displacement.dx;
          const actualY = y + displacement.dy;

          if (y === 0) {
            ctx.moveTo(actualX, actualY);
          } else {
            ctx.lineTo(actualX, actualY);
          }
        }

        // Gradient stroke
        const gradient = ctx.createLinearGradient(x, 0, x + 4, 0);
        gradient.addColorStop(0, "rgba(204, 141, 81, 0.2)");
        gradient.addColorStop(0.5, "rgba(225, 164, 107, 0.5)");
        gradient.addColorStop(1, "rgba(204, 141, 81, 0.2)");
        ctx.strokeStyle = gradient;
        ctx.stroke();
      }

      // Draw horizontal lines
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.lineWidth = 3;

        for (let x = 0; x <= canvas.width; x += 5) {
          const displacement = getDisplacement(x, y);
          const actualX = x + displacement.dx;
          const actualY = y + displacement.dy;

          if (x === 0) {
            ctx.moveTo(actualX, actualY);
          } else {
            ctx.lineTo(actualX, actualY);
          }
        }

        // Gradient stroke
        const gradient = ctx.createLinearGradient(0, y, 0, y + 4);
        gradient.addColorStop(0, "rgba(204, 141, 81, 0.2)");
        gradient.addColorStop(0.5, "rgba(225, 164, 107, 0.5)");
        gradient.addColorStop(1, "rgba(204, 141, 81, 0.2)");
        ctx.strokeStyle = gradient;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(drawGrid);
    };

    drawGrid();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "fixed inset-0 -z-10 pointer-events-none",
        className
      )}
    />
  );
}
