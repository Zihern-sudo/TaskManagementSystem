import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// ── POST /api/profile/avatar ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail("Request must be multipart/form-data.");
  }

  const file = formData.get("avatar") as File | null;
  if (!file) return fail("No file uploaded.");

  if (!ALLOWED_TYPES.includes(file.type)) {
    return fail("Only JPG, PNG, and WebP images are allowed.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    return fail("Image must be under 2MB.");
  }

  // Read file bytes
  const buffer = Buffer.from(await file.arrayBuffer());

  // Resize to 256x256 centre-crop, output WebP
  let resized: Buffer;
  try {
    resized = await sharp(buffer)
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return fail("Failed to process image. Make sure it is a valid image file.");
  }

  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Delete old avatar file if it exists
  const existing = await db.user.findUnique({
    where: { id: caller.id },
    select: { avatarUrl: true },
  });
  if (existing?.avatarUrl) {
    const oldFile = path.join(process.cwd(), "public", existing.avatarUrl);
    await fs.unlink(oldFile).catch(() => null); // ignore if already gone
  }

  // Save new file
  const filename = `${caller.id}.webp`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), resized);

  const avatarUrl = `/uploads/avatars/${filename}`;

  await db.user.update({
    where: { id: caller.id },
    data: { avatarUrl },
  });

  return ok("Avatar uploaded.", { avatarUrl });
}

// ── DELETE /api/profile/avatar ─────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const user = await db.user.findUnique({
    where: { id: caller.id },
    select: { avatarUrl: true },
  });

  if (user?.avatarUrl) {
    const filePath = path.join(process.cwd(), "public", user.avatarUrl);
    await fs.unlink(filePath).catch(() => null);
  }

  await db.user.update({
    where: { id: caller.id },
    data: { avatarUrl: null },
  });

  return ok("Avatar removed.");
}
