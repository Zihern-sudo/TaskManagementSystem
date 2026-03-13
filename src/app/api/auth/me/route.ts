import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

/**
 * GET /api/auth/me
 * Returns the current authenticated user from session headers.
 */
export async function GET(req: NextRequest) {
  const user = getRequestUser(req);
  if (!user) return fail("Not authenticated.", 401);
  return ok("Session retrieved.", { user });
}
