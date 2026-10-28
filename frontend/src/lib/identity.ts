"use client";

import { handleFor, useAuth } from "@/lib/auth/store";
import { useLocalProfile } from "@/lib/local/profile";

/**
 * The one identity every surface renders: the signed-in account when
 * a session exists (name + @handle derived from the account email),
 * otherwise the local profile — a generated guest identity
 * (`user411`) until the guest customizes it in Settings. The sidebar
 * bubble, the Settings card and the chat's user turns all read this,
 * so they can never disagree the way the old hardcoded dummy did.
 */
export interface Identity {
  name: string;
  handle: string;
  email: string | null;
  isAccount: boolean;
}

export function useIdentity(): Identity {
  const { user } = useAuth();
  const { profile } = useLocalProfile();
  if (user) {
    return {
      name: user.name,
      handle: handleFor(user),
      email: user.email,
      isAccount: true,
    };
  }
  return {
    name: profile.display_name,
    handle: profile.handle,
    email: null,
    isAccount: false,
  };
}
