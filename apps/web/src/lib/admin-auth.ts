import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAdminAllowlist() {
  return {
    userIds: parseAllowlist(process.env.ADMIN_USER_IDS),
    emails: parseAllowlist(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  };
}

/** Clerk session allowlist check for Server Components and browser-initiated API calls. */
export async function isAdminUser(): Promise<boolean> {
  const { userIds, emails } = getAdminAllowlist();
  if (userIds.length === 0 && emails.length === 0) return false;
  if (!process.env.CLERK_SECRET_KEY) return false;

  try {
    const { userId } = await auth();
    if (!userId) return false;
    if (userIds.includes(userId)) return true;

    const user = await currentUser();
    const primaryEmail = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
    const fallbackEmail = user?.emailAddresses?.[0]?.emailAddress;
    const email = (primaryEmail ?? fallbackEmail)?.toLowerCase();
    return email ? emails.includes(email) : false;
  } catch {
    return false;
  }
}

/** Redirect non-admins away from admin UI. */
export async function requireAdminSession(): Promise<void> {
  const ok = await isAdminUser();
  if (!ok) redirect("/");
}

/** Service-to-service admin key (mutating routes only — never expose to client). */
export function requireAdminKey(req: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const header =
    req.headers.get("x-admin-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === expected;
}

/** Accept Clerk admin session OR service API key. */
export async function requireAdminAuth(req: Request): Promise<boolean> {
  if (requireAdminKey(req)) return true;
  return isAdminUser();
}
