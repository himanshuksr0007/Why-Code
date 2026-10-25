import { cn } from "@/lib/utils";

/**
 * Initials avatar. Deliberately not an image: sample fixtures have no avatars,
 * and rendering deterministic initials keeps the UI readable offline and avoids
 * shipping other people's photos into a demo. Swap for `next/image` when the
 * live API starts returning `avatar_url` (see README).
 */

const AVATAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const SIZES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-12 text-base",
} as const;

export type AvatarSize = keyof typeof SIZES;

function hashLogin(login: string): number {
  let hash = 0;
  for (let index = 0; index < login.length; index += 1) {
    hash = (hash * 31 + login.charCodeAt(index)) % 100_000;
  }
  return hash;
}

export function initialsFor(login: string): string {
  const cleaned = login.replace(/[^a-zA-Z0-9]/g, "");
  return (cleaned.slice(0, 2) || "?").toUpperCase();
}

/** Same palette as the avatar circle, resolved to hex for standalone SVGs. */
const SVG_COLORS = ["#89d185", "#75beff", "#b180d7", "#cca700", "#f48771"];

/**
 * A self-contained SVG data URL of a person's initials avatar.
 *
 * The tooltip-avatar component renders `<img src>`, and CSS variables are not
 * available inside an isolated SVG document — so this emits concrete colours
 * and a transparent background that composites onto either theme.
 */
export function initialsAvatarDataUrl(login: string): string {
  const color = SVG_COLORS[hashLogin(login) % SVG_COLORS.length];
  const initials = initialsFor(login);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" rx="32" fill="${color}" fill-opacity="0.18"/>`,
    `<circle cx="32" cy="32" r="31" fill="none" stroke="${color}" stroke-opacity="0.4" stroke-width="1.5"/>`,
    '<text x="32" y="41" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="600"',
    ` fill="${color}">${initials}</text>`,
    "</svg>",
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function PersonAvatar({
  login,
  size = "md",
  className,
}: {
  login: string;
  size?: AvatarSize;
  className?: string;
}) {
  const color = AVATAR_COLORS[hashLogin(login) % AVATAR_COLORS.length];
  return (
    // The login is always rendered as text next to the avatar, so the circle
    // itself is decorative.
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-heading font-semibold select-none",
        SIZES[size],
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 40%, transparent)`,
      }}
    >
      {initialsFor(login)}
    </span>
  );
}
