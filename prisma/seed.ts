import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Default Admin ──────────────────────────────────────────────
  const adminEmail = "admin@taskmanager.com";
  const adminPassword = "Admin@1234";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing) {
    console.log(`⚠️  Admin user already exists (${adminEmail}), skipping.`);
  } else {
    const hashed = await bcrypt.hash(adminPassword, 12);

    await prisma.user.create({
      data: {
        fullName: "Admin",
        email: adminEmail,
        password: hashed,
        role: "admin",
        status: "active",
      },
    });

    console.log(`✅  Admin created: ${adminEmail}`);
  }

  console.log("✅  Seeding complete.");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
