import { ok } from "@/lib/response";
import { clearSessionCookie } from "@/lib/session";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie, effectively signing the user out.
 */
export async function POST() {
  await clearSessionCookie();
  return ok("Logged out successfully.");
}
