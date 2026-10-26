"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated 3D wave background using CSS and subtle transforms
 * Creates a flowing, organic wave effect matching the UI references
 */
export function WaveBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    // Wave configuration
    const waves = [
      {
        y: canvas.height * 0.3,
        length: 0.015,
        amplitude: 80,
        frequency: 0.012,
        color: "rgba(232, 160, 48, 0.08)",
        speed: 0.003,
      },
      {
        y: canvas.height * 0.5,
        length: 0.012,
        amplitude: 100,
        frequency: 0.015,
        color: "rgba(245, 239, 230, 0.12)",
        speed: 0.002,
      },
      {
        y: canvas.height * 0.7,
        length: 0.018,
        amplitude: 60,
        frequency: 0.01,
        color: "rgba(232, 160, 48, 0.06)",
        speed: 0.0025,
      },
    ];

    let animationId: number;
    let increment = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      waves.forEach((wave) => {
        ctx.fillStyle = wave.color;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        // Draw flowing wave
        for (let i = 0; i < canvas.width; i++) {
          const y =
            wave.y +
            Math.sin(i * wave.length + increment * wave.speed) * wave.amplitude +
            Math.sin(i * wave.frequency + increment * 0.5) * (wave.amplitude * 0.5);
          
          if (i === 0) {
            ctx.moveTo(i, y);
          } else {
            ctx.lineTo(i, y);
          }
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();
      });

      increment += 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "fixed inset-0 -z-10 opacity-60 pointer-events-none",
        className
      )}
      style={{ mixBlendMode: "normal" }}
    />
  );
}

/**
 * SVG-based wave background with CSS animations
 * Lighter weight alternative with smooth flowing motion
 */
export function SVGWaveBackground({ className }: { className?: string }) {
  return (
    <div className={cn("fixed inset-0 -z-10 overflow-hidden", className)}>
      {/* Wave 1 - Top layer */}
      <svg
        className="absolute inset-0 w-full h-full animate-wave-slow"
        style={{ animationDelay: "0s" }}
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="wave1-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(232, 160, 48, 0.08)" />
            <stop offset="50%" stopColor="rgba(245, 239, 230, 0.15)" />
            <stop offset="100%" stopColor="rgba(232, 160, 48, 0.08)" />
          </linearGradient>
        </defs>
        <path
          d="M0,200 C320,250 480,150 720,200 C960,250 1120,150 1440,200 L1440,800 L0,800 Z"
          fill="url(#wave1-gradient)"
          opacity="0.6"
        >
          <animate
            attributeName="d"
            dur="15s"
            repeatCount="indefinite"
            values="
              M0,200 C320,250 480,150 720,200 C960,250 1120,150 1440,200 L1440,800 L0,800 Z;
              M0,180 C320,150 480,230 720,180 C960,150 1120,230 1440,180 L1440,800 L0,800 Z;
              M0,220 C320,200 480,180 720,220 C960,200 1120,180 1440,220 L1440,800 L0,800 Z;
              M0,200 C320,250 480,150 720,200 C960,250 1120,150 1440,200 L1440,800 L0,800 Z"
          />
        </path>
      </svg>

      {/* Wave 2 - Middle layer */}
      <svg
        className="absolute inset-0 w-full h-full animate-wave-medium"
        style={{ animationDelay: "-5s" }}
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="wave2-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(240, 230, 220, 0.12)" />
            <stop offset="100%" stopColor="rgba(232, 160, 48, 0.06)" />
          </linearGradient>
        </defs>
        <path
          d="M0,350 C360,400 540,300 720,350 C900,400 1080,300 1440,350 L1440,800 L0,800 Z"
          fill="url(#wave2-gradient)"
          opacity="0.5"
        >
          <animate
            attributeName="d"
            dur="20s"
            repeatCount="indefinite"
            values="
              M0,350 C360,400 540,300 720,350 C900,400 1080,300 1440,350 L1440,800 L0,800 Z;
              M0,330 C360,300 540,380 720,330 C900,300 1080,380 1440,330 L1440,800 L0,800 Z;
              M0,370 C360,350 540,330 720,370 C900,350 1080,330 1440,370 L1440,800 L0,800 Z;
              M0,350 C360,400 540,300 720,350 C900,400 1080,300 1440,350 L1440,800 L0,800 Z"
          />
        </path>
      </svg>

      {/* Wave 3 - Bottom layer */}
      <svg
        className="absolute inset-0 w-full h-full animate-wave-fast"
        style={{ animationDelay: "-10s" }}
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="wave3-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245, 239, 230, 0.1)" />
            <stop offset="100%" stopColor="rgba(232, 160, 48, 0.04)" />
          </radialGradient>
        </defs>
        <path
          d="M0,500 C400,550 600,450 720,500 C840,550 1040,450 1440,500 L1440,800 L0,800 Z"
          fill="url(#wave3-gradient)"
          opacity="0.4"
        >
          <animate
            attributeName="d"
            dur="12s"
            repeatCount="indefinite"
            values="
              M0,500 C400,550 600,450 720,500 C840,550 1040,450 1440,500 L1440,800 L0,800 Z;
              M0,480 C400,450 600,530 720,480 C840,450 1040,530 1440,480 L1440,800 L0,800 Z;
              M0,520 C400,500 600,480 720,520 C840,500 1040,480 1440,520 L1440,800 L0,800 Z;
              M0,500 C400,550 600,450 720,500 C840,550 1040,450 1440,500 L1440,800 L0,800 Z"
          />
        </path>
      </svg>

      {/* Ambient glow overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-30" />
    </div>
  );
}

/**
 * Lightweight CSS-only wave background
 * Pure CSS solution for maximum performance
 */
export function CSSWaveBackground({ className }: { className?: string }) {
  return (
    <div className={cn("fixed inset-0 -z-10 overflow-hidden bg-background", className)}>
      {/* Wave layers using pseudo-elements and CSS animations */}
      <div className="wave-container">
        <div className="wave wave-1" />
        <div className="wave wave-2" />
        <div className="wave wave-3" />
        <div className="wave wave-4" />
      </div>
    </div>
  );
}
