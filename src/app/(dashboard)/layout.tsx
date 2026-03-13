import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 ml-64 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
