import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Appearance, answer service and local data settings.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
