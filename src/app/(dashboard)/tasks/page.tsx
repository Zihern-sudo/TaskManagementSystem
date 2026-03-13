import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import TaskBoard from "@/components/TaskBoard";
import BoardDiscussion from "@/components/BoardDiscussion";
import { SessionUser } from "@/types";

export const metadata = { title: "Board – RIO Task" };

export default async function TasksPage() {
  const cookieStore = await cookies();
  const tokenValue = cookieStore.get(SESSION_COOKIE)?.value;
  if (!tokenValue) redirect("/login");
  const session = await decodeSession(tokenValue);
  if (!session) redirect("/login");

  const currentUser: SessionUser = {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role as "admin" | "member",
  };

  return (
    <div className="flex flex-col min-h-full">
      <TaskBoard currentUser={currentUser} />
      <BoardDiscussion currentUser={currentUser} />
    </div>
  );
}
