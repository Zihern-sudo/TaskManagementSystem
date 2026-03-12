import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { setSessionCookie, toSessionPayload } from "@/lib/session";

/**
 * POST /api/auth/login
 *
 * Body: { email: string; password: string }
 *
 * Validates credentials and issues a session cookie.
 * The account must have status "active" to sign in.
 */
export async function POST(req: NextRequest) {
  // ── Parse body ───────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body)
  ) {
    return fail("email and password are required.");
  }

  const { email, password } = body as { email: unknown; password: unknown };

  if (typeof email !== "string" || !email.trim()) {
    return fail("email must be a non-empty string.");
  }
  if (typeof password !== "string" || !password) {
    return fail("password must be a non-empty string.");
  }

  // ── Look up user ─────────────────────────────────────────────────────────
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      fullName: true,
      email: true,
      password: true,
      role: true,
      status: true,
    },
  });

  // Use a constant-time comparison so that non-existent email and wrong
  // password produce the same response time, limiting user enumeration.
  const dummyHash =
    "$2a$12$KIXxxx/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  const passwordToCheck = user?.password ?? dummyHash;
  const passwordMatch = await bcrypt.compare(password, passwordToCheck);

  if (!user || !passwordMatch) {
    return fail("Invalid email or password.", 401);
  }

  if (user.status !== "active") {
    return fail("Your account is not active. Please contact an administrator.", 403);
  }

  // ── Issue session ────────────────────────────────────────────────────────
  await setSessionCookie(toSessionPayload(user));

  return ok("Logged in successfully.", {
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
    },
  });
}
