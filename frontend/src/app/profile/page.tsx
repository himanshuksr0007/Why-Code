import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = {
  title: "Profile & settings",
  description: "Your local Why-Code profile, preferences and saved chats.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-wide text-primary uppercase">
          Account
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold">
          Profile &amp; settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your name, active repository and saved conversations live in this
          browser. Nothing is sent anywhere.
        </p>
      </header>

      <ProfileView />
    </div>
  );
}
