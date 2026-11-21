/**
 * Direct email sign-up accepts common mailbox providers only (mirrors
 * ALLOWED_EMAIL_DOMAINS in backend/app/auth/service.py — keep the two
 * lists in sync). The backend is the enforcement point; this copy exists
 * so the form can say no instantly instead of after a round-trip.
 * Social sign-in is not gated by this list: Google/GitHub have already
 * verified the address.
 */
export const ALLOWED_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.in", "outlook.co.uk", "hotmail.com",
  "hotmail.in", "hotmail.co.uk", "hotmail.fr", "live.com", "live.in",
  "msn.com",
  "yahoo.com", "yahoo.in", "yahoo.co.in", "yahoo.co.uk", "ymail.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "pm.me",
  "aol.com", "gmx.com", "gmx.net", "mail.com", "zoho.com",
  "zohomail.com", "rediffmail.com", "yandex.com", "qq.com",
  "naver.com", "fastmail.com", "tuta.com", "hey.com", "web.de",
  "t-online.de", "orange.fr", "free.fr", "libero.it", "mail.ru",
]);

export function emailDomainAllowed(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return ALLOWED_EMAIL_DOMAINS.has(domain);
}

export const EMAIL_DOMAIN_MESSAGE =
  "Please use an email from a common provider (Gmail, Outlook, Hotmail, Yahoo, iCloud, Proton…) — disposable or uncommon domains can't sign up directly. You can still continue with Google or GitHub above.";
