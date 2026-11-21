import type { NextConfig } from "next";

function httpOrigin(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  } catch {
    return;
  }
}

function clerkOrigin(): string | undefined {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key || !/^pk_(test|live)_/.test(key)) return;
  // Clerk encodes the Frontend API hostname with a trailing dollar sign.
  const decoded = Buffer.from(key.replace(/^pk_(test|live)_/, ""), "base64").toString("utf8");
  if (/^[a-z0-9.-]+\$$/i.test(decoded)) return `https://${decoded.slice(0, -1)}`;
}

function contentSecurityPolicy(): string {
  const development = process.env.NODE_ENV === "development";
  const clerk = clerkOrigin();
  const cloudflare = "https://challenges.cloudflare.com";
  const protect = "https://*.protect.clerk.com";
  const api = httpOrigin(process.env.NEXT_PUBLIC_API_BASE_URL);
  const directives = [
    ["default-src", "'self'"],
    ["script-src", "'self'", "'unsafe-inline'", development && "'unsafe-eval'", clerk, cloudflare, protect],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:", "https://avatars.githubusercontent.com", "https://img.clerk.com"],
    ["font-src", "'self'", "data:"],
    [
      "connect-src", "'self'", api, "https://why-code.onrender.com", "https://api.github.com",
      clerk, "https://clerk-telemetry.com", "https://*.clerk-telemetry.com", "https://img.clerk.com",
      `${protect}:*`, development && "ws://localhost:*", development && "ws://127.0.0.1:*",
    ],
    ["frame-src", "'self'", clerk, cloudflare, protect],
    ["worker-src", "'self'", "blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'self'"],
  ];
  return directives.map((directive) => directive.filter(Boolean).join(" ")).join("; ");
}

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: process.env.WHYCODE_CSP_MODE === "enforce"
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy(),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), camera=(), payment=()",
          },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
