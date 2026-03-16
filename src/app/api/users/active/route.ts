import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

// GET /api/users/active
// Returns all active users — used to populate the @mention dropdown.

export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const users = await db.user.findMany({
    where: { status: "active" },
    select: { id: true, fullName: true, email: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
  });

  return ok("Active users retrieved.", { users });
}
