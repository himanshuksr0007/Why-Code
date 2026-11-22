import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Clerk is an additive sign-in layer, mounted only when a publishable
// key is configured (see components/clerk-shell.tsx). Without one —
// local dev, the offline demo — the middleware must pass requests
// through untouched: clerkMiddleware() throws when the key is missing,
// which would take every page down in exactly the setups the demo
// scripts start.
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default clerkEnabled
  ? clerkMiddleware()
  : function proxy(_request: NextRequest) {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
