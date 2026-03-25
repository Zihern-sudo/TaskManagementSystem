import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Date helpers ────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding database...");

  // ── Guard: wipe partial seed data and re-run cleanly ─────────────────────
  // Deletes only seed-created members (not the admin). Safe to re-run.
  const seedEmails = [
    "sarah.chen@company.com",
    "james.wilson@company.com",
    "priya.patel@company.com",
    "marcus.rodriguez@company.com",
    "emily.thompson@company.com",
    "alex.kim@company.com",
    "david.nguyen@company.com",
  ];
  const existingSeed = await prisma.user.findFirst({
    where: { email: { in: seedEmails } },
  });
  if (existingSeed) {
    console.log("🧹 Cleaning up previous seed data...");
    // Delete in dependency order
    await prisma.boardReaction.deleteMany({});
    await prisma.boardComment.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.taskAssignee.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: seedEmails } } });
    console.log("✅  Cleanup done.");
  }

  // ── 1. Admin ───────────────────────────────────────────────────────────────
  const adminEmail = "admin@taskmanager.com";
  const adminPassword = "Admin@1234";
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hashed = await bcrypt.hash(adminPassword, 12);
    admin = await prisma.user.create({
      data: {
        fullName: "Admin",
        email: adminEmail,
        password: hashed,
        hasSetPassword: true,
        role: "admin",
        status: "active",
      },
    });
    console.log(`✅  Admin created: ${adminEmail}`);
  } else {
    console.log(`⚠️  Admin already exists (${adminEmail}), reusing.`);
  }

  // ── 2. Team members ────────────────────────────────────────────────────────
  const memberPassword = await bcrypt.hash("Member@1234", 12);

  const members = await Promise.all([
    prisma.user.create({
      data: {
        fullName: "Sarah Chen",
        email: "sarah.chen@company.com",
        password: memberPassword,
        hasSetPassword: true,
        role: "member",
        status: "active",
        createdAt: daysAgo(90),
      },
    }),
    prisma.user.create({
      data: {
        fullName: "James Wilson",
        email: "james.wilson@company.com",
        password: memberPassword,
        hasSetPassword: true,
        role: "member",
        status: "active",
        createdAt: daysAgo(85),
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Priya Patel",
        email: "priya.patel@company.com",
        password: memberPassword,
        hasSetPassword: true,
        role: "member",
        status: "active",
        createdAt: daysAgo(75),
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Marcus Rodriguez",
        email: "marcus.rodriguez@company.com",
        password: memberPassword,
        hasSetPassword: true,
        role: "member",
        status: "active",
        createdAt: daysAgo(60),
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Emily Thompson",
        email: "emily.thompson@company.com",
        password: memberPassword,
        hasSetPassword: true,
        role: "member",
        status: "active",
        createdAt: daysAgo(45),
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Alex Kim",
        email: "alex.kim@company.com",
        role: "member",
        status: "invited",
        createdAt: daysAgo(5),
      },
    }),
    prisma.user.create({
      data: {
        fullName: "David Nguyen",
        email: "david.nguyen@company.com",
        role: "member",
        status: "pending",
        createdAt: daysAgo(2),
      },
    }),
  ]);

  const [sarah, james, priya, marcus, emily] = members;
  console.log(`✅  Created ${members.length} team members.`);

  // ── 3. Tasks ───────────────────────────────────────────────────────────────
  // Completed tasks — spread updatedAt across last 30 days for the trend chart
  type CompletedTask = {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    dueDate: Date;
    completedDaysAgo: number; // sets updatedAt via raw SQL later
    assignees: string[];
    createdDaysAgo: number;
  };

  const completedTaskDefs: CompletedTask[] = [
    {
      title: "Set up CI/CD pipeline",
      description: "Configure GitHub Actions for automated testing and deployment to staging.",
      priority: "high",
      dueDate: daysAgo(28),
      completedDaysAgo: 27,
      assignees: [james.id, admin.id],
      createdDaysAgo: 40,
    },
    {
      title: "Design onboarding flow mockups",
      description: "Create high-fidelity Figma mockups for the new user onboarding screens.",
      priority: "high",
      dueDate: daysAgo(25),
      completedDaysAgo: 24,
      assignees: [priya.id, sarah.id],
      createdDaysAgo: 38,
    },
    {
      title: "Migrate legacy user data",
      description: "Write and execute migration scripts to port user records from the old database.",
      priority: "critical",
      dueDate: daysAgo(22),
      completedDaysAgo: 21,
      assignees: [james.id],
      createdDaysAgo: 35,
    },
    {
      title: "Implement JWT refresh token logic",
      description: "Add sliding session support with secure httpOnly refresh tokens.",
      priority: "high",
      dueDate: daysAgo(20),
      completedDaysAgo: 19,
      assignees: [james.id, sarah.id],
      createdDaysAgo: 32,
    },
    {
      title: "Create design system component library",
      description: "Build reusable Storybook components aligned with the new brand guidelines.",
      priority: "medium",
      dueDate: daysAgo(18),
      completedDaysAgo: 17,
      assignees: [priya.id],
      createdDaysAgo: 30,
    },
    {
      title: "Write API documentation",
      description: "Document all REST endpoints using OpenAPI 3.0 spec in Swagger UI.",
      priority: "medium",
      dueDate: daysAgo(16),
      completedDaysAgo: 15,
      assignees: [james.id, emily.id],
      createdDaysAgo: 28,
    },
    {
      title: "Fix login page responsiveness on mobile",
      description: "Resolve layout breakpoints and touch-target sizing on small screens.",
      priority: "high",
      dueDate: daysAgo(14),
      completedDaysAgo: 13,
      assignees: [sarah.id],
      createdDaysAgo: 22,
    },
    {
      title: "Set up error monitoring with Sentry",
      description: "Integrate Sentry SDK, configure source maps, and set up alerting rules.",
      priority: "medium",
      dueDate: daysAgo(12),
      completedDaysAgo: 11,
      assignees: [marcus.id, james.id],
      createdDaysAgo: 20,
    },
    {
      title: "Conduct usability testing session",
      description: "Run 5 moderated usability tests on the new dashboard with real users.",
      priority: "high",
      dueDate: daysAgo(10),
      completedDaysAgo: 9,
      assignees: [emily.id, priya.id],
      createdDaysAgo: 18,
    },
    {
      title: "Optimize database query performance",
      description: "Profile slow queries and add appropriate indexes to reduce p95 latency.",
      priority: "critical",
      dueDate: daysAgo(9),
      completedDaysAgo: 8,
      assignees: [james.id],
      createdDaysAgo: 16,
    },
    {
      title: "Implement role-based access control",
      description: "Add admin/member permission gates to all API routes and UI views.",
      priority: "critical",
      dueDate: daysAgo(8),
      completedDaysAgo: 7,
      assignees: [james.id, sarah.id],
      createdDaysAgo: 15,
    },
    {
      title: "Write unit tests for task service layer",
      description: "Achieve 80% coverage on the core task CRUD operations using Jest.",
      priority: "medium",
      dueDate: daysAgo(6),
      completedDaysAgo: 5,
      assignees: [marcus.id],
      createdDaysAgo: 14,
    },
    {
      title: "Accessibility audit — WCAG 2.1 AA",
      description: "Run axe-core and manual keyboard navigation checks across all pages.",
      priority: "high",
      dueDate: daysAgo(4),
      completedDaysAgo: 3,
      assignees: [priya.id, sarah.id],
      createdDaysAgo: 12,
    },
    {
      title: "Update privacy policy and terms of service",
      description: "Reflect GDPR/CCPA requirements, reviewed by legal.",
      priority: "low",
      dueDate: daysAgo(3),
      completedDaysAgo: 2,
      assignees: [emily.id],
      createdDaysAgo: 10,
    },
    {
      title: "Deploy v1.2.0 to production",
      description: "Blue-green deployment with rollback plan, post-deploy smoke tests.",
      priority: "critical",
      dueDate: daysAgo(1),
      completedDaysAgo: 1,
      assignees: [james.id, marcus.id, admin.id],
      createdDaysAgo: 8,
    },
  ];

  // In-progress tasks
  const inProgressTaskDefs = [
    {
      title: "Build task comment threading UI",
      description: "Support nested replies with expand/collapse and mention highlighting.",
      priority: "high" as const,
      dueDate: daysFromNow(3),
      assignees: [sarah.id, priya.id],
    },
    {
      title: "Implement real-time notifications",
      description: "Use WebSockets to push task assignment and status change alerts.",
      priority: "high" as const,
      dueDate: daysFromNow(5),
      assignees: [james.id],
    },
    {
      title: "Dashboard analytics charts",
      description: "Recharts-based KPI widgets showing completion rates and velocity trends.",
      priority: "medium" as const,
      dueDate: daysFromNow(7),
      assignees: [sarah.id, emily.id],
    },
    {
      title: "User avatar upload and cropping",
      description: "Integrate file upload with S3 presigned URLs and client-side image crop.",
      priority: "medium" as const,
      dueDate: daysFromNow(4),
      assignees: [priya.id],
    },
    {
      title: "Overdue task email digest",
      description: "Cron job that sends a daily summary of overdue tasks to assignees.",
      priority: "high" as const,
      dueDate: daysAgo(2), // overdue
      assignees: [james.id, emily.id],
    },
    {
      title: "Drag-and-drop Kanban board",
      description: "Implement @dnd-kit sortable across status columns with optimistic updates.",
      priority: "high" as const,
      dueDate: daysAgo(1), // overdue
      assignees: [sarah.id],
    },
    {
      title: "Password reset email flow",
      description: "Secure token-based reset with 15-minute expiry and brute-force protection.",
      priority: "critical" as const,
      dueDate: daysAgo(3), // overdue
      assignees: [james.id],
    },
    {
      title: "Integrate Stripe billing",
      description: "Subscription management for Pro tier with webhook handling.",
      priority: "critical" as const,
      dueDate: daysFromNow(10),
      assignees: [james.id, admin.id],
    },
    {
      title: "Export tasks to PDF and CSV",
      description: "Generate formatted reports with filters for date range and status.",
      priority: "low" as const,
      dueDate: daysFromNow(14),
      assignees: [sarah.id],
    },
    {
      title: "Refactor API error handling middleware",
      description: "Standardise error response shape and add request ID tracing.",
      priority: "medium" as const,
      dueDate: daysAgo(4), // overdue
      assignees: [james.id, marcus.id],
    },
  ];

  // In-review tasks
  const inReviewTaskDefs = [
    {
      title: "Search and filter for task list",
      description: "Full-text search with debounce, multi-filter support, and URL query sync.",
      priority: "high" as const,
      dueDate: daysFromNow(2),
      assignees: [sarah.id],
    },
    {
      title: "Dark mode theming",
      description: "CSS variables-based dark mode with OS preference detection and toggle.",
      priority: "low" as const,
      dueDate: daysFromNow(6),
      assignees: [priya.id, sarah.id],
    },
    {
      title: "Audit log for admin actions",
      description: "Record user creation, deletion, and role changes in an immutable log table.",
      priority: "high" as const,
      dueDate: daysFromNow(1),
      assignees: [james.id],
    },
    {
      title: "Onboarding wizard — step 2 & 3",
      description: "Team invite and workspace setup steps, wired to the real API.",
      priority: "medium" as const,
      dueDate: daysFromNow(4),
      assignees: [sarah.id, emily.id],
    },
    {
      title: "Performance regression test suite",
      description: "k6 load tests for key endpoints, run nightly in CI.",
      priority: "medium" as const,
      dueDate: daysFromNow(8),
      assignees: [marcus.id],
    },
    {
      title: "Internationalisation (i18n) foundation",
      description: "Set up next-intl with en/es locale routing and translation key structure.",
      priority: "low" as const,
      dueDate: daysFromNow(12),
      assignees: [sarah.id, priya.id],
    },
  ];

  // Not-started tasks
  const notStartedTaskDefs = [
    {
      title: "Mobile app — React Native scaffold",
      description: "Initialise Expo project with shared TypeScript types and auth flow.",
      priority: "high" as const,
      dueDate: daysFromNow(20),
      assignees: [sarah.id, james.id],
    },
    {
      title: "Two-factor authentication (TOTP)",
      description: "Add TOTP-based 2FA with QR code setup and backup codes.",
      priority: "critical" as const,
      dueDate: daysFromNow(15),
      assignees: [james.id],
    },
    {
      title: "Team activity heatmap",
      description: "GitHub-style contribution heatmap showing task completions per day.",
      priority: "low" as const,
      dueDate: daysFromNow(30),
      assignees: [sarah.id],
    },
    {
      title: "Custom task fields (labels, story points)",
      description: "Allow admins to define extra metadata fields per workspace.",
      priority: "medium" as const,
      dueDate: daysFromNow(25),
      assignees: [emily.id, priya.id],
    },
    {
      title: "SSO — Google Workspace integration",
      description: "OAuth2 sign-in with Google, auto-provision users by email domain.",
      priority: "high" as const,
      dueDate: daysFromNow(18),
      assignees: [james.id],
    },
    {
      title: "Recurring task scheduler",
      description: "Allow tasks to auto-recreate on a daily / weekly / monthly cadence.",
      priority: "medium" as const,
      dueDate: daysFromNow(28),
      assignees: [james.id, emily.id],
    },
    {
      title: "In-app guided product tour",
      description: "Shepherd.js walkthrough highlighting key features for new users.",
      priority: "low" as const,
      dueDate: daysFromNow(35),
      assignees: [priya.id],
    },
    {
      title: "Slack integration — task notifications",
      description: "Post to a configurable Slack channel on task assignment and status change.",
      priority: "medium" as const,
      dueDate: daysFromNow(22),
      assignees: [james.id, marcus.id],
    },
  ];

  // ── Create completed tasks ─────────────────────────────────────────────────
  const completedTaskIds: { id: string; completedDaysAgo: number }[] = [];

  for (const def of completedTaskDefs) {
    const task = await prisma.task.create({
      data: {
        title: def.title,
        description: def.description,
        status: "completed",
        priority: def.priority,
        dueDate: def.dueDate,
        createdAt: daysAgo(def.createdDaysAgo),
        assignees: {
          create: def.assignees.map((uid) => ({ userId: uid })),
        },
      },
    });
    completedTaskIds.push({ id: task.id, completedDaysAgo: def.completedDaysAgo });
  }

  // ── Create in-progress tasks ───────────────────────────────────────────────
  for (const def of inProgressTaskDefs) {
    await prisma.task.create({
      data: {
        title: def.title,
        description: def.description,
        status: "in_progress",
        priority: def.priority,
        dueDate: def.dueDate,
        createdAt: daysAgo(14),
        assignees: {
          create: def.assignees.map((uid) => ({ userId: uid })),
        },
      },
    });
  }

  // ── Create in-review tasks ─────────────────────────────────────────────────
  for (const def of inReviewTaskDefs) {
    await prisma.task.create({
      data: {
        title: def.title,
        description: def.description,
        status: "in_review",
        priority: def.priority,
        dueDate: def.dueDate,
        createdAt: daysAgo(10),
        assignees: {
          create: def.assignees.map((uid) => ({ userId: uid })),
        },
      },
    });
  }

  // ── Create not-started tasks ───────────────────────────────────────────────
  for (const def of notStartedTaskDefs) {
    await prisma.task.create({
      data: {
        title: def.title,
        description: def.description,
        status: "not_started",
        priority: def.priority,
        dueDate: def.dueDate,
        createdAt: daysAgo(7),
        assignees: {
          create: def.assignees.map((uid) => ({ userId: uid })),
        },
      },
    });
  }

  console.log(`✅  Created ${completedTaskDefs.length + inProgressTaskDefs.length + inReviewTaskDefs.length + notStartedTaskDefs.length} tasks.`);

  // ── 4. Back-date completed task updatedAt for trend chart ──────────────────
  // Prisma's @updatedAt auto-sets to now(); override via raw SQL.
  for (const { id, completedDaysAgo } of completedTaskIds) {
    const completedAt = daysAgo(completedDaysAgo);
    await prisma.$executeRaw`
      UPDATE tasks SET "updatedAt" = ${completedAt} WHERE id = ${id}
    `;
  }
  console.log("✅  Back-dated completed task timestamps for trend chart.");

  // ── 5. Comments (activity feed) ────────────────────────────────────────────
  // Fetch the tasks we just created so we can attach comments to real IDs
  const allTasks = await prisma.task.findMany({
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  const taskByTitle = (title: string) =>
    allTasks.find((t) => t.title === title)!;

  const commentDefs = [
    {
      task: "Build task comment threading UI",
      author: sarah.id,
      content: "Finished the reply collapse logic — PR up for review.",
      createdAt: daysAgo(1),
    },
    {
      task: "Build task comment threading UI",
      author: priya.id,
      content: "Love the nested indent design. Can we add a 'mention' autocomplete too?",
      createdAt: daysAgo(1),
    },
    {
      task: "Implement real-time notifications",
      author: james.id,
      content: "WebSocket server is up on staging. Need to add reconnect backoff.",
      createdAt: daysAgo(2),
    },
    {
      task: "Dashboard analytics charts",
      author: emily.id,
      content: "PMs want a burndown chart added to the sprint view — can we scope it?",
      createdAt: daysAgo(2),
    },
    {
      task: "Dashboard analytics charts",
      author: sarah.id,
      content: "Happy to add it. Will need a sprint model in the DB first though.",
      createdAt: daysAgo(2),
    },
    {
      task: "Password reset email flow",
      author: james.id,
      content: "Added brute-force protection with rate limiting at the API gateway level.",
      createdAt: daysAgo(3),
    },
    {
      task: "Drag-and-drop Kanban board",
      author: sarah.id,
      content: "DnD is working smoothly! Optimistic updates reduce latency by ~300ms.",
      createdAt: daysAgo(3),
    },
    {
      task: "Search and filter for task list",
      author: sarah.id,
      content: "Search debounce at 300ms feels snappy. Submitted for QA review.",
      createdAt: daysAgo(1),
    },
    {
      task: "Search and filter for task list",
      author: marcus.id,
      content: "Tested cross-browser — all good on Chrome, Firefox and Safari.",
      createdAt: daysAgo(1),
    },
    {
      task: "Integrate Stripe billing",
      author: james.id,
      content: "Webhook endpoint is secured with signature verification. Testing webhooks locally with the Stripe CLI.",
      createdAt: daysAgo(1),
    },
    {
      task: "Audit log for admin actions",
      author: james.id,
      content: "Schema migration done. Logging create/update/delete events for users and tasks.",
      createdAt: daysAgo(2),
    },
    {
      task: "Two-factor authentication (TOTP)",
      author: emily.id,
      content: "Security team confirmed TOTP is sufficient for compliance — no SMS required.",
      createdAt: daysAgo(1),
    },
    {
      task: "Mobile app — React Native scaffold",
      author: sarah.id,
      content: "Initialised with Expo SDK 51. Sharing the auth hook from the web app works well.",
      createdAt: daysAgo(1),
    },
    {
      task: "Overdue task email digest",
      author: emily.id,
      content: "Email template approved by design. Just wiring up the cron schedule.",
      createdAt: daysAgo(2),
    },
    {
      task: "Refactor API error handling middleware",
      author: marcus.id,
      content: "Found 12 inconsistent error shapes across the codebase. Tagging for the refactor.",
      createdAt: daysAgo(3),
    },
  ];

  for (const def of commentDefs) {
    const task = taskByTitle(def.task);
    if (!task) continue;
    await prisma.comment.create({
      data: {
        content: def.content,
        taskId: task.id,
        authorId: def.author,
        createdAt: def.createdAt,
      },
    });
  }
  console.log(`✅  Created ${commentDefs.length} task comments.`);

  // ── 6. Board comments (discussion tab) ────────────────────────────────────
  const boardCommentDefs = [
    {
      author: emily.id,
      content: "Team — sprint 4 planning is Thursday at 2pm. Please update your task estimates by Wednesday EOD.",
      createdAt: daysAgo(3),
    },
    {
      author: james.id,
      content: "Staging environment is back up after the DB migration. All services healthy.",
      createdAt: daysAgo(2),
    },
    {
      author: priya.id,
      content: "New brand colours are finalised! Updating the design tokens in Figma now — devs, expect a tokens export shortly.",
      createdAt: daysAgo(2),
    },
    {
      author: sarah.id,
      content: "Reminder: please squash your commits before merging to main. Keeping the history clean.",
      createdAt: daysAgo(1),
    },
    {
      author: marcus.id,
      content: "QA sign-off on the Kanban drag-and-drop. No blocking issues found.",
      createdAt: daysAgo(1),
    },
    {
      author: admin.id,
      content: "Great velocity this sprint everyone 🚀 We're on track for the v1.3.0 release.",
      createdAt: daysAgo(1),
    },
  ];

  const boardComments = [];
  for (const def of boardCommentDefs) {
    const bc = await prisma.boardComment.create({
      data: {
        content: def.content,
        authorId: def.author,
        createdAt: def.createdAt,
      },
    });
    boardComments.push(bc);
  }

  // Add a reply to the first board comment
  await prisma.boardComment.create({
    data: {
      content: "Got it — I'll have my estimates in by Tuesday to be safe.",
      authorId: sarah.id,
      parentId: boardComments[0].id,
      createdAt: daysAgo(2),
    },
  });
  await prisma.boardComment.create({
    data: {
      content: "Same here. Also flagging that the Stripe task might slip — dependency on legal approval.",
      authorId: james.id,
      parentId: boardComments[0].id,
      createdAt: daysAgo(2),
    },
  });

  console.log(`✅  Created ${boardCommentDefs.length + 2} board comments.`);

  console.log("\n✅  Seeding complete!");
  console.log("─────────────────────────────────────────────────");
  console.log("  Admin:   admin@taskmanager.com  /  Admin@1234");
  console.log("  Member:  sarah.chen@company.com /  Member@1234");
  console.log("  Member:  james.wilson@company.com / Member@1234");
  console.log("─────────────────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
