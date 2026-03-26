import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { db } from "@/lib/db";
import DashboardShell from "@/components/DashboardShell";
import { FieldLayoutProvider } from "@/context/FieldLayoutContext";
import { SessionUser } from "@/types";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tokenValue = cookieStore.get(SESSION_COOKIE)?.value;

  if (!tokenValue) redirect("/login");

  const session = await decodeSession(tokenValue);
  if (!session) redirect("/login");

  const user: SessionUser = {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role as "admin" | "member",
  };

  const dbUser = await db.user.findUnique({
    where: { id: session.id },
    select: { hasSetPassword: true },
  });

  return (
    <FieldLayoutProvider>
      <DashboardShell user={user} needsPasswordSetup={dbUser?.hasSetPassword === false}>
        {children}
      </DashboardShell>
    </FieldLayoutProvider>
  );
}
