import { notFound } from "next/navigation";

import { PersonProfileView } from "@/components/people/person-profile-view";
import { getActiveRepo } from "@/lib/active-repo";
import { api } from "@/lib/api";

/**
 * A profile has no meaningful static shell: the login is a dynamic param and
 * every value comes from the request-time API. Opting the segment out of
 * static-shell validation lets the route block while it loads instead of
 * failing the build (the shared nav reads `usePathname`, which cannot resolve
 * during prerendering for an unknown param). Awaiting the params at the top
 * level also means an unknown login can return a real 404 status.
 */
export const instant = false;

export async function generateMetadata(props: PageProps<"/people/[login]">) {
  const { login } = await props.params;
  return { title: `@${login}` };
}

export default async function PersonPage(props: PageProps<"/people/[login]">) {
  const { login } = await props.params;
  const repo = await getActiveRepo();
  const profile = await api.getPerson(repo, login).catch(() => null);
  if (!profile) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <PersonProfileView profile={profile} />
    </div>
  );
}
