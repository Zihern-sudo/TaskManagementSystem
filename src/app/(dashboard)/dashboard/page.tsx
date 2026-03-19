import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { db } from "@/lib/db";
import KpiCards, { KpiData } from "./components/KpiCards";
import TaskStatusChart, { StatusCount } from "./components/TaskStatusChart";
import PriorityBarChart, { PriorityCount } from "./components/PriorityBarChart";
import CompletionTrend, { TrendPoint } from "./components/CompletionTrend";
import TeamWorkload, { WorkloadItem } from "./components/TeamWorkload";
import ActivityFeed, { ActivityItem } from "./components/ActivityFeed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTrendDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Build a zero-filled 30-day trend array then fill in actual counts
function buildTrend(
  completedTasks: { updatedAt: Date }[],
  days = 30
): TrendPoint[] {
  const now = new Date();
  const points: TrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    points.push({ date: formatTrendDate(d), completed: 0 });
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  for (const task of completedTasks) {
    const d = task.updatedAt;
    if (d < cutoff) continue;
    const label = formatTrendDate(d);
    const point = points.find((p) => p.date === label);
    if (point) point.completed += 1;
  }

  return points;
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchAdminData() {
  const now = new Date();

  const [tasks, activeUsers] = await Promise.all([
    db.task.findMany({
      select: {
        status: true,
        priority: true,
        dueDate: true,
        updatedAt: true,
        assignees: {
          select: {
            userId: true,
            user: { select: { id: true, fullName: true } },
          },
        },
      },
    }),
    db.user.count({ where: { status: "active" } }),
  ]);

  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== "completed"
  ).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const kpi: KpiData = { total, inProgress, overdue, completionRate, activeUsers, isAdmin: true };

  const statusLabels: Record<string, string> = {
    not_started: "To Do",
    in_progress: "In Progress",
    in_review:   "In Review",
    completed:   "Done",
  };
  const statusMap: Record<string, number> = { not_started: 0, in_progress: 0, in_review: 0, completed: 0 };
  for (const t of tasks) statusMap[t.status] = (statusMap[t.status] ?? 0) + 1;
  const statusData: StatusCount[] = Object.entries(statusMap).map(([status, count]) => ({
    status, label: statusLabels[status] ?? status, count, color: "",
  }));

  const priorityLabels: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
  const priorityMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const t of tasks) priorityMap[t.priority] = (priorityMap[t.priority] ?? 0) + 1;
  const priorityData: PriorityCount[] = Object.entries(priorityMap).map(([priority, count]) => ({
    priority, label: priorityLabels[priority] ?? priority, count,
  }));

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const trendData = buildTrend(completedTasks);

  // Team workload: tasks per user
  const workloadMap = new Map<string, WorkloadItem>();
  for (const task of tasks) {
    for (const a of task.assignees) {
      const uid = a.user.id;
      if (!workloadMap.has(uid)) {
        workloadMap.set(uid, { userId: uid, name: a.user.fullName, tasks: 0, completed: 0 });
      }
      const entry = workloadMap.get(uid)!;
      entry.tasks += 1;
      if (task.status === "completed") entry.completed += 1;
    }
  }
  const workloadData: WorkloadItem[] = Array.from(workloadMap.values());

  return { kpi, statusData, priorityData, trendData, workloadData };
}

async function fetchMemberData(userId: string) {
  const now = new Date();

  // Get task IDs assigned to this user
  const assignments = await db.taskAssignee.findMany({
    where: { userId },
    select: { taskId: true },
  });
  const taskIds = assignments.map((a) => a.taskId);

  const tasks = await db.task.findMany({
    where: { id: { in: taskIds } },
    select: { status: true, priority: true, dueDate: true, updatedAt: true },
  });

  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== "completed"
  ).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const kpi: KpiData = { total, inProgress, overdue, completionRate, isAdmin: false };

  const statusLabels: Record<string, string> = {
    not_started: "To Do",
    in_progress: "In Progress",
    in_review:   "In Review",
    completed:   "Done",
  };
  const statusMap: Record<string, number> = { not_started: 0, in_progress: 0, in_review: 0, completed: 0 };
  for (const t of tasks) statusMap[t.status] = (statusMap[t.status] ?? 0) + 1;
  const statusData: StatusCount[] = Object.entries(statusMap).map(([status, count]) => ({
    status, label: statusLabels[status] ?? status, count, color: "",
  }));

  const priorityLabels: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
  const priorityMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const t of tasks) priorityMap[t.priority] = (priorityMap[t.priority] ?? 0) + 1;
  const priorityData: PriorityCount[] = Object.entries(priorityMap).map(([priority, count]) => ({
    priority, label: priorityLabels[priority] ?? priority, count,
  }));

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const trendData = buildTrend(completedTasks);

  return { kpi, statusData, priorityData, trendData };
}

async function fetchActivity(userId: string, isAdmin: boolean): Promise<ActivityItem[]> {
  const where = isAdmin
    ? {}
    : {
        task: {
          assignees: { some: { userId } },
        },
      };

  const comments = await db.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { fullName: true, avatarUrl: true } },
      task: { select: { id: true, title: true } },
    },
  });

  return comments.map((c) => ({
    id: c.id,
    content: c.content,
    authorName: c.author.fullName,
    authorAvatar: c.author.avatarUrl,
    taskTitle: c.task.title,
    taskId: c.task.id,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const tokenValue = cookieStore.get(SESSION_COOKIE)?.value;
  if (!tokenValue) redirect("/login");
  const session = await decodeSession(tokenValue);
  if (!session) redirect("/login");

  const isAdmin = session.role === "admin";

  const [dashData, activityItems] = await Promise.all([
    isAdmin ? fetchAdminData() : fetchMemberData(session.id),
    fetchActivity(session.id, isAdmin),
  ]);

  const { kpi, statusData, priorityData, trendData } = dashData;
  const workloadData = isAdmin && "workloadData" in dashData ? dashData.workloadData : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isAdmin
              ? "System-wide overview of tasks and team activity"
              : "Your personal task overview and recent activity"}
          </p>
        </div>

        {/* KPI Cards */}
        <KpiCards data={kpi} />

        {/* Row 2: Status donut + Priority bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Task Status</h2>
            <TaskStatusChart data={statusData} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Priority Breakdown</h2>
            <PriorityBarChart data={priorityData} />
          </div>
        </div>

        {/* Row 3: Completion trend (full width) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-slate-700">Completion Trend</h2>
            <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5">
              Last 30 days
            </span>
          </div>
          <CompletionTrend data={trendData} />
        </div>

        {/* Row 4: Team Workload (admin) + Activity Feed */}
        <div className={`grid grid-cols-1 gap-6 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
          {isAdmin && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-semibold text-slate-700">Team Workload</h2>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-400" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-100" />
                    Total
                  </span>
                </div>
              </div>
              <TeamWorkload data={workloadData} />
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-[13px] font-semibold text-slate-700 mb-4">Recent Activity</h2>
            <ActivityFeed items={activityItems} />
          </div>
        </div>

      </div>
    </div>
  );
}
