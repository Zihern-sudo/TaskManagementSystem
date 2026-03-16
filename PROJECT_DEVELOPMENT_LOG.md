# Task Management System – Version 1
## Project Development Log

---

## 1. Project Overview

### What Is the Task Management System Version 1?

The **Task Management System Version 1** (internally referred to as the *RIO Task* project) is a full-stack, web-based team collaboration platform built with **Next.js 16**, **PostgreSQL**, and **Prisma ORM**. It allows teams to create and manage tasks on a Kanban board, assign them to team members, track progress, communicate through threaded comments and a shared discussion board, and manage user accounts through an admin interface.

### Purpose of the System

The system was designed to provide a **Jira-inspired** task management experience tailored for small-to-medium teams. Key goals included:

- Giving team members a visual Kanban board to track work from start to completion
- Allowing rich collaboration through task comments, replies, emoji reactions, and a team-wide discussion board
- Providing admins a full user management interface including email invitations and role-based access
- Supporting modern authentication flows including magic link (passwordless) login

### How Claude Code Was Used During Development

Every line of the system was developed using **Claude Code**, Anthropic's AI coding assistant. Over a 4-day development session (March 12–16, 2026), Claude Code was prompted by the developer to scaffold the project, build each feature layer by layer, fix bugs as they arose, and refine the UX. The developer directed the work through natural language prompts, while Claude Code wrote the implementation, proposed database schema changes, debugged errors, and pushed code to the feature branch.

---

## 2. Development Timeline

### Development Timeline Table

| Phase | Development Step | Feature | Description |
|-------|-----------------|---------|-------------|
| 1 | Initial Scaffold | Project Setup | Scaffold full-stack Next.js + Prisma + PostgreSQL application with TypeScript, Tailwind CSS, folder structure, and base configuration |
| 2 | Backend Auth | Authentication API | Implement JWT session management, bcrypt password hashing, login endpoint, middleware for protected routes, and seed admin user |
| 3 | Backend Users | Admin User Management API | Build admin-only CRUD endpoints for users, invite token generation and email dispatch, role enforcement in middleware |
| 4 | Backend Tasks | Task Board & Comments API | Implement full CRUD for tasks including status updates, comments with threaded replies, and cascade deletes |
| 5 | Prisma Fixes | Database Connection Fixes | Fix Prisma v7 compatibility issues with PostgreSQL adapter, datasource URL injection, dotenv config loading in seed |
| 6 | Frontend Core | Jira-Inspired UI | Build login page, dashboard layout, Kanban board with drag-and-drop, list view, task modal, comments section, user management table |
| 7 | Frontend Auth | Invite Flow & Magic Link Login | Add `/accept-invite` page, `/auth/magic` page, tabbed login modes, invite revocation UI |
| 8 | UI Polish | Login Page & Kanban Style | Enhance login page design with gradient and feature pills; fix To Do column dashed border |
| 9 | Feature Expansion | Multi-Assignee, Board Discussion, Sorting, Profile Page | Support up to 5 assignees per task, add team discussion board, make list view columns sortable, add profile page |
| 10 | Fix | Empty API Response Crash | Handle non-JSON and empty API responses to prevent runtime crash |
| 11 | Feature | Profile Photo Upload | Add drag-and-drop photo upload with WebP resize to 256×256; fix `#` column sorting in list view |
| 12 | Fix | Duplicate Emoji Reactions | Prevent duplicate reaction submissions via in-flight guard |
| 13 | Fix | Task Load Error Banner | Show visible error banner with retry button instead of silently rendering empty board |
| 14 | Feature | Consistent Avatar Display | Show profile photos across all avatar locations in the UI |
| 15 | Feature | Reaction Optimistic Updates & My Tasks Badge | Fix reaction toggle, add optimistic UI updates, show My Tasks count badge in sidebar |
| 16 | Fix | Reaction Button Disabled State | Correct disabled state logic on reaction buttons and add error recovery |
| 17 | Feature | Pagination, Task Activity Feed, Pin Comments | Add list view pagination (10/page), task comment feed in modal, ability to pin top-level comments |
| 18 | Fix | Board-Comments GET Fallback | Handle old cached Prisma client missing `pinned`/`pinnedAt` fields gracefully |
| 19 | Fix | Board Discussion Post & Pin Reliability | Ensure POST and pin only update UI on success; add fallback Prisma select |
| 20 | Feature | @Mention Support & Email Notifications | Allow `@username` mentions in discussion and comments, send email notifications to mentioned users |
| 21 | Fix | @Mention Dropdown Overflow Clipping | Rewrite dropdown as a portal at `document.body` using `getBoundingClientRect()` to escape overflow constraints |
| 22 | Fix | Missing x-user-name Header | Inject `x-user-name` from session into middleware headers so mention emails show sender's name |
| 23 | Fix | Prisma Migration for Pinned Fields | Create migration for `pinned`/`pinnedAt` columns that were in schema but never migrated to database |
| 24 | Feature | JIRA-Style Task Modal, Toast Notifications, Confirm Dialogs | Redesign task modal as two-column layout, install Sonner for toast feedback, replace `confirm()` with polished ConfirmDialog component |
| 25 | Feature | Reply, Pin, Edit, Delete in Task Activity | Full CRUD actions on task comments directly within the modal's Activity section |
| 26 | Fix | Pin Resetting & Missing Replies in Task Activity | Decouple board/task comment fetches into independent try-catch blocks; add replies to task activity feed |
| 27 | Fix | Deactivate User & Prevent Past Due Dates | Add status change support in admin PATCH API; add `min=today` to date inputs and server-side past-date validation |

---

## 3. Feature Development

### Feature 1 — Project Scaffold

**Purpose:** Establish the foundational project structure and configuration so all subsequent features have a consistent base to build upon.

**Original Prompt:** Set up a full-stack RIO Task web application using Next.js, PostgreSQL, and Prisma with TypeScript and Tailwind CSS.

**AI Response Summary:** Claude Code generated the complete project scaffold including `package.json` with all dependencies (Next.js 16, React 19, Prisma 7, Tailwind CSS v4, bcryptjs, jsonwebtoken, nodemailer, @dnd-kit), the initial `prisma/schema.prisma` with `User`, `Task`, `TaskAssignee`, `Comment`, `BoardComment`, and `BoardReaction` models, environment variable configuration, TypeScript settings, and a `prisma/seed.ts` file that creates a default admin account.

**Implementation Approach:** The scaffold followed a standard Next.js App Router structure with an `src/` directory. The database schema was designed upfront with all relationships — `Task` has many `TaskAssignee` entries (join table capped at 5), `Comment` is self-referential for replies, and `BoardComment` mirrors the same pattern for team discussion.

---

### Feature 2 — Authentication System

**Purpose:** Secure the application so only registered users can access it, with role-based access separating admin capabilities from member capabilities.

**Original Prompt:** Implement the backend authentication system with email/password login, JWT sessions, and route protection middleware.

**AI Response Summary:** Claude Code built `src/lib/session.ts` for JWT encode/decode with 30-day expiry and `httpOnly` cookies, a `POST /api/auth/login` endpoint using bcrypt comparison, `GET /api/auth/me` to return the current user from injected headers, `POST /api/auth/logout` to clear the session cookie, and `src/middleware.ts` to protect all dashboard routes. The middleware reads the JWT, validates it, and injects `x-user-id` and `x-user-role` request headers so API routes can identify the caller without redundant DB lookups.

**Key Code Logic:** Middleware runs before every request to `/` routes. If no valid session cookie is found the user is redirected to `/login`. Admin-only routes (starting with `/api/admin`) return 403 if `x-user-role` is not `admin`.

---

### Feature 3 — Admin User Management API

**Purpose:** Allow administrators to create, update, invite, and delete user accounts from a central interface.

**Original Prompt:** Implement admin user management with CRUD endpoints and an invite email flow.

**AI Response Summary:** Claude Code created `GET/POST /api/admin/users` and `PATCH/DELETE /api/admin/users/[id]`, plus `POST /api/admin/users/[id]/invite` and `POST /api/admin/users/[id]/revoke-invite`. New users are created with status `pending` and a bcrypt-hashed placeholder password that can never match a login attempt. The invite endpoint generates a random token stored with a 48-hour expiry and dispatches an email via `src/lib/mail.ts`. The revoke endpoint clears the token and resets status to `pending`.

**Key Code Logic:** User statuses follow a lifecycle: `pending` → `invited` (after invite sent) → `active` (after invite accepted). Admins cannot change their own status, preventing accidental self-lockout.

---

### Feature 4 — Task Board & Comments API

**Purpose:** Provide the core data layer for creating, reading, updating, and deleting tasks and their comments.

**Original Prompt:** Implement the task board and comments API with full CRUD and threaded replies.

**AI Response Summary:** Claude Code built `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/[id]`, a dedicated `PATCH /api/tasks/[id]/status` for drag-and-drop updates, `GET/POST /api/tasks/[id]/comments`, and `PATCH/DELETE /api/comments/[id]`. Cascade delete rules ensure task deletion automatically removes all associated comments and replies. The comments API enforces a strict two-level threading rule — replies to replies are rejected with HTTP 400.

**Key Code Logic:** The status-only PATCH endpoint was specifically designed to return a minimal `{ id, status, updatedAt }` payload for efficiency during Kanban drag-and-drop operations, avoiding re-fetching the full task.

---

### Feature 5 — Jira-Inspired Frontend UI

**Purpose:** Give users a polished, familiar interface modelled on Jira — with a Kanban board, list view, task modal, comments, and user management table.

**Original Prompt:** Build a Jira-inspired UI with a Kanban board, drag-and-drop, task CRUD modal, comments section, and user management table.

**AI Response Summary:** Claude Code built the entire frontend in one large commit: a split-panel login page, a collapsible sidebar dashboard layout, `TaskBoard.tsx` (Kanban view with `@dnd-kit` for drag-and-drop between four columns: To Do, In Progress, In Review, Done), a list view with search and status filters, `TaskModal.tsx` for creating and editing tasks, `CommentSection.tsx` for threaded replies, and `UserManagementTable.tsx` for admin functions.

**Key Code Logic:** The Kanban board uses `@dnd-kit/core`'s `DndContext` with `DragOverlay`. On drop, an optimistic status update is applied locally and a PATCH to `/api/tasks/[id]/status` is fired. If the API call fails the UI reverts to the previous state.

---

### Feature 6 — Invite Flow & Magic Link Login

**Purpose:** Let invited users set their password via a secure token link, and let any user log in without a password using a one-time magic link.

**Original Prompt:** Implement the invite accept flow, magic link login, and invite revocation on the frontend.

**AI Response Summary:** Claude Code added `/accept-invite` page (token verification → password creation form with live requirements checklist → auto-login on success), `/auth/magic` page (reads token from URL, calls verify endpoint, redirects to `/tasks`), updated the login page with tabs for Password / Magic Link modes, updated `UserManagementTable` to show context-sensitive action buttons per status (Send Invite for pending, Revoke for invited, Deactivate for active), and whitelisted the new pages in middleware so unauthenticated users can access them.

---

### Feature 7 — Multi-Assignee, Board Discussion, Sortable Tables, Profile Page

**Purpose:** Expand collaboration features — allow multiple assignees per task, add a team discussion channel, make the list view sortable, and let users manage their profile.

**Original Prompt:** Implement multi-assignee support (up to 5), a board discussion section, sortable table columns, and a user profile page with name/password editing.

**AI Response Summary:** Claude Code updated the task schema to use a `TaskAssignee` join table with a uniqueness constraint and a maximum of 5 assignees, added `AvatarGroup.tsx` to render stacked avatar circles, built `BoardDiscussion.tsx` as a panel below the task board with real-time-style comment posting, added click-to-sort to every column header in list view, and created `ProfilePage` with name editing, password change (requires current password), and a task summary stat card.

---

### Feature 8 — Profile Photo Upload

**Purpose:** Allow users to personalise their accounts with a profile photo that appears throughout the UI.

**Original Prompt:** Add profile photo upload with drag-and-drop support and fix the `#` column sorting in list view.

**AI Response Summary:** Claude Code added `POST /api/profile/avatar` accepting `multipart/form-data`, using the `sharp` library to resize and convert uploads to 256×256 WebP, storing the result as a base64 data URI in the `avatarUrl` database field. A drag-and-drop zone was added to `ProfilePage`. `DELETE /api/profile/avatar` clears the stored value. The `#` column sort bug (which was treating row numbers as strings causing incorrect ordering) was also fixed in the same commit.

---

### Feature 9 — Consistent Avatar Display

**Purpose:** Ensure profile photos appear uniformly in every location a user avatar is shown.

**Original Prompt:** Show profile photos consistently across all avatar locations in the UI.

**AI Response Summary:** Claude Code audited all places where user avatars are rendered — task assignee chips in the Kanban card, the assignee selector in TaskModal, the `AvatarGroup` component in list view, and the sidebar user info area — and updated each to use `avatarUrl` when available, falling back to initials with a coloured background when not.

---

### Feature 10 — Emoji Reactions & Optimistic UI

**Purpose:** Let users react to board discussion comments with emoji, with instant feedback before the server confirms.

**Original Prompt:** Fix the reaction toggle, add optimistic updates, improve contrast, and add a My Tasks count badge.

**AI Response Summary:** Claude Code rewrote the reaction handling in `BoardDiscussion.tsx` to apply the reaction change locally to the UI state immediately (optimistic update), then fire the API call. If the API returns an error, the change is reverted. A `My Tasks` badge was added to the sidebar showing the count of tasks assigned to the current user. A contrast background was added to the board area to improve visual separation.

---

### Feature 11 — Pagination

**Purpose:** Prevent the list view from becoming unwieldy as tasks accumulate, by paginating results.

**Original Prompt:** Add pagination to the list view, show 10 tasks per page.

**AI Response Summary:** Claude Code added client-side pagination to `TaskBoard.tsx` in list view mode: 10 tasks per page, previous/next buttons, numbered page buttons, and automatic page reset when search or filter values change. Row numbers in the `#` column are offset correctly per page (e.g. page 2 starts at row 11).

---

### Feature 12 — Task Activity Feed & Pin Comments

**Purpose:** Show all comments for a task directly inside the task modal, and allow important comments to be pinned to the top.

**Original Prompt:** Add a task activity feed inside the task modal and allow pinning top-level comments.

**AI Response Summary:** Claude Code added a `pinned` / `pinnedAt` field to the `Comment` model, created `POST /api/comments/[id]/pin` to toggle pin state, updated the board-comments GET endpoint to return both board comments and task comments sorted with pinned items first, and rendered the activity feed inside `TaskModal` using a new `TaskActivityItem` subcomponent with toggle-able reply visibility.

---

### Feature 13 — @Mention Support & Email Notifications

**Purpose:** Allow users to tag teammates in comments, triggering email notifications to the mentioned users.

**Original Prompt:** Add @mention support to the board discussion with email notifications for mentioned users.

**AI Response Summary:** Claude Code created `GET /api/users/active` returning all active users for the mention dropdown, built `MentionTextarea.tsx` — a textarea where typing `@` opens a filtered dropdown navigable by keyboard — and updated `POST /api/board-comments` to accept `mentionedUserIds[]` and fire mention notification emails via `buildMentionEmail` in `mail.ts`. Mentioned names appear as blue highlighted chips in rendered comments.

---

### Feature 14 — JIRA-Style Task Modal Redesign

**Purpose:** Redesign the task edit modal to match the familiar two-column layout used in Jira, making it easier to view and update all task details at once.

**Original Prompt:** Redesign the task modal in JIRA style with a two-column layout. Left column: title, description, activity. Right column: status, priority, due date, assignees, timestamps.

**AI Response Summary:** Claude Code rebuilt `TaskModal.tsx` in edit mode as a wide two-column layout. The left panel contains the task title as a large inline editable input, the description field, and the full Activity/comments section always visible. The right panel contains Status, Priority, Due Date, and Assignees controls, plus creation and last-updated timestamps. The create-task mode keeps a compact single-column form. A live status badge and priority dot are shown in the modal header.

---

### Feature 15 — Toast Notifications & Confirm Dialogs

**Purpose:** Replace browser `alert()`/`confirm()` dialogs with polished in-app notifications and custom confirmation modals.

**Original Prompt:** Add toast notifications for all mutations and replace all `confirm()` calls with a proper ConfirmDialog component.

**AI Response Summary:** Claude Code installed `sonner` and added `<Toaster>` to the root layout. Every mutating action across `TaskBoard`, `TaskModal`, `BoardDiscussion`, `CommentSection`, `UserManagementTable`, and `ProfilePage` was wired to `toast.success()` or `toast.error()`. A shared `ConfirmDialog.tsx` component was created and used wherever destructive actions occur (delete task, delete comment, deactivate user, delete user, revoke invite).

---

### Feature 16 — Full Task Activity CRUD (Reply, Pin, Edit, Delete)

**Purpose:** Allow users to interact fully with task comments directly inside the modal, without navigating away.

**Original Prompt:** Add reply, pin, edit, and delete actions to the Task Activity section of the task modal.

**AI Response Summary:** Claude Code updated `TaskActivityItem` to show action buttons per comment — owners and admins see Reply, Pin, Edit, Delete; other users see Reply and Pin only. Edit shows an inline textarea. Pin toggles optimistically. A new `POST /api/comments/[id]/pin` endpoint was created for task comments (separate from the board comment pin endpoint). Replies are shown/hidden with a toggle button and auto-expand after a new reply is posted.

---

## 4. Bugs and Problems Encountered

### Bug 1 — Prisma Seed Fails: DATABASE_URL Not Loaded

**Feature:** Project Scaffold / Database Setup

**What Went Wrong:** Running `npm run db:seed` threw an error because `PrismaClient` was instantiated before `dotenv` loaded the environment variables, so `DATABASE_URL` was `undefined`.

**Error Behaviour:** Prisma client initialised with no database URL, causing an immediate connection failure on seed.

**Cause:** The seed file (`prisma/seed.ts`) imported `PrismaClient` at the top level before calling `dotenv/config`, so the env var was not yet in `process.env` at the time Prisma read it.

---

### Bug 2 — Prisma v7 DATABASE_URL Not Found in Schema

**Feature:** Database Connection

**What Went Wrong:** Prisma could not find the database URL at runtime when running in the Next.js server environment.

**Error Behaviour:** Prisma threw a datasource URL error on any database query.

**Cause:** Prisma v7 requires the `DATABASE_URL` to be declared explicitly in the schema's `datasource` block or passed via the `datasourceUrl` constructor option. The initial schema did not include this.

---

### Bug 3 — Prisma v7 Requires pg Adapter

**Feature:** Database Connection

**What Went Wrong:** After the datasource fix, Prisma still failed at runtime with an error about the database driver.

**Error Behaviour:** Prisma threw a runtime connection error.

**Cause:** Prisma v7 removed the bundled query engine for Node.js edge runtimes and requires an explicit database adapter. The `@prisma/adapter-pg` package needed to be passed to the `PrismaClient` constructor.

---

### Bug 4 — Null assignedUserId Rejected in Task Creation

**Feature:** Task CRUD API

**What Went Wrong:** Creating a task without an assignee threw a validation error.

**Error Behaviour:** HTTP 400 returned from `POST /api/tasks` when `assignedUserId` was `null` or absent.

**Cause:** The server-side validation was checking for the presence of `assignedUserId` and rejecting `null`, even though unassigned tasks are valid.

---

### Bug 5 — To Do Column Border Invisible

**Feature:** Kanban Board UI

**What Went Wrong:** The "To Do" column's dashed border was not visible.

**Error Behaviour:** The To Do column appeared to have no border, unlike the other columns.

**Cause:** The column background colour and border colour were the same CSS class, making the dashed border transparent against the background.

---

### Bug 6 — Empty / Non-JSON API Responses Crashed the Frontend

**Feature:** Task Board / General API Handling

**What Went Wrong:** Certain API responses (empty body, or non-200 with HTML error pages) caused a `JSON.parse` runtime exception that crashed the component.

**Error Behaviour:** The entire task board would go blank with an unhandled promise rejection in the console.

**Cause:** Response `.json()` was called unconditionally. When the server returned an empty body or an HTML error page, JSON parsing threw an exception.

---

### Bug 7 — Duplicate Emoji Reactions Could Be Submitted

**Feature:** Board Discussion Reactions

**What Went Wrong:** Clicking a reaction button rapidly multiple times could submit the same reaction more than once before the first API call completed.

**Error Behaviour:** Duplicate reaction entries appeared in the database, causing incorrect reaction counts.

**Cause:** There was no in-flight guard on the reaction API call. Multiple simultaneous POST requests could race to the same endpoint.

---

### Bug 8 — Task Board Silently Empty on Load Failure

**Feature:** Task Board

**What Went Wrong:** If the `/api/tasks` fetch failed (network error, server crash), the board simply showed no tasks with no explanation.

**Error Behaviour:** The user saw an empty board with no indication that something went wrong.

**Cause:** The error from the failed fetch was caught and discarded, leaving the tasks array empty.

---

### Bug 9 — Reaction Button Disabled State Incorrect

**Feature:** Board Discussion Reactions

**What Went Wrong:** The reaction button disable logic was inverted, causing buttons to be active when they should be disabled and vice versa.

**Error Behaviour:** Users could click already-processing reactions, or were blocked from clicking ones that were ready.

**Cause:** A boolean expression in the `disabled` prop was negated incorrectly.

---

### Bug 10 — Board-Comments GET Crashed with Missing pinned/pinnedAt Fields

**Feature:** Board Discussion / Pin Feature

**What Went Wrong:** After the pin feature was added to the schema, the cached Prisma client in the Next.js dev server did not have the new fields, causing the GET endpoint to fail.

**Error Behaviour:** `GET /api/board-comments` returned a 500 error; the board discussion panel would not load.

**Cause:** Next.js hot-reload caches the Prisma client instance between requests. Adding new model fields requires a dev server restart to regenerate the client, but the cached client was being used in the meantime.

---

### Bug 11 — Board Discussion POST Not Clearing Input on Failure

**Feature:** Board Discussion

**What Went Wrong:** When a POST request failed, the comment input was still cleared and the UI acted as if the comment was posted successfully.

**Error Behaviour:** Users would see their input disappear with no confirmation that the comment was actually saved, causing confusion and lost messages.

**Cause:** The input clear and UI refresh code ran unconditionally after the API call instead of being gated on a successful response.

---

### Bug 12 — @Mention Dropdown Clipped by Overflow Hidden

**Feature:** @Mention Support

**What Went Wrong:** The @mention dropdown that appears while typing did not show in the board discussion area.

**Error Behaviour:** The dropdown was invisible — clipped by the `overflow: hidden` CSS on the board container.

**Cause:** The dropdown was rendered inside the normal DOM flow, beneath a container that had `overflow: hidden`. The dropdown's absolute positioning caused it to render outside the visible area.

---

### Bug 13 — Mention Emails Showing "undefined mentioned you"

**Feature:** @Mention Email Notifications

**What Went Wrong:** Email notifications sent to mentioned users showed "undefined mentioned you" instead of the sender's name.

**Error Behaviour:** Mention notification emails had malformed subject lines and body text with "undefined" as the sender name.

**Cause:** The middleware was injecting `x-user-id` and `x-user-role` headers from the session, but not `x-user-name`. API routes that needed the caller's display name had no way to retrieve it without an extra database query.

---

### Bug 14 — Prisma Migration Missing for pinned/pinnedAt on board_comments

**Feature:** Pin Comments (Board Discussion)

**What Went Wrong:** Board comment POST requests returned `P2022` Prisma errors immediately after the pin feature was added.

**Error Behaviour:** Any attempt to create a board comment threw a Prisma `P2022` column not found error.

**Cause:** The `pinned` and `pinnedAt` fields were added to `BoardComment` in `schema.prisma` but the corresponding SQL migration was never generated and run, so the database table did not have those columns.

---

### Bug 15 — Pin State Resetting When Task Comments Failed

**Feature:** Task Activity Feed / Pin Comments

**What Went Wrong:** Pinning a board comment would work briefly, but then the pin state would reset unexpectedly.

**Error Behaviour:** After interacting with a task (opening the modal, which loads task comments), pinned board comments would appear unpinned.

**Cause:** The `GET /api/board-comments` endpoint fetched both board comments and task comments in a single `Promise.all`. If the task comments query failed (e.g. because a task was not found), the entire response was replaced with an error, wiping the board comment state including pins.

---

### Bug 16 — Past Due Dates Accepted in Task Creation

**Feature:** Task CRUD / TaskModal

**What Went Wrong:** Users could create or edit tasks with due dates in the past, setting deadlines that were already missed.

**Error Behaviour:** The date picker allowed selecting past dates; tasks could be saved with `dueDate` values earlier than today.

**Cause:** No validation (frontend or backend) restricted the minimum selectable date.

---

### Bug 17 — Admin Could Deactivate Their Own Account

**Feature:** User Management / Deactivate User

**What Went Wrong:** An admin could change their own account status to `pending`, locking themselves out of the system.

**Error Behaviour:** After setting their own status to pending, the admin's session would become invalid and they would be unable to log back in as an admin.

**Cause:** The PATCH user endpoint did not guard against the authenticated user updating their own `status` field.

---

## 5. Debugging and Fix Section

### Fix 1 — Prisma Seed dotenv Loading Order

**Debugging Process:** The error stack trace pointed directly to `PrismaClient` initialisation. The cause was identified by inspecting the import order in `seed.ts`.

**Prompt Used:** Fix the seed file so dotenv is loaded before PrismaClient is initialised.

**Final Solution:** Moved `import 'dotenv/config'` (or `require('dotenv').config()`) to the very first line of `seed.ts`, before any Prisma imports. This ensures `process.env.DATABASE_URL` is populated before Prisma reads it.

---

### Fix 2 — Prisma v7 DATABASE_URL in Schema

**Debugging Process:** The Prisma error message indicated it could not find the datasource URL. The Prisma v7 changelog was referenced to confirm the new requirement.

**Prompt Used:** Fix Prisma datasource to include DATABASE_URL for v7 compatibility.

**Final Solution:** Added `url = env("DATABASE_URL")` to the `datasource db` block in `schema.prisma`, and also passed `datasourceUrl: process.env.DATABASE_URL` to the `PrismaClient` constructor in `src/lib/db.ts`.

---

### Fix 3 — Prisma v7 pg Adapter

**Debugging Process:** The runtime driver error pointed to missing adapter support. Prisma v7 documentation confirmed the pg adapter requirement.

**Prompt Used:** Use the pg adapter for Prisma v7 runtime database connection.

**Final Solution:** Installed `@prisma/adapter-pg` and `pg`, then updated `src/lib/db.ts` to create a `Pool` from `pg` and pass it as `new PrismaClient({ adapter: new PrismaPostgres(pool) })`.

---

### Fix 4 — Null assignedUserId Validation

**Debugging Process:** Traced the 400 error to the task creation validation logic. Identified that the check was too strict.

**Prompt Used:** Allow null assignedUserId in task creation validation.

**Final Solution:** Updated the validation in `POST /api/tasks` to accept `null` or absent `assignedUserId`, only validating the value when it is actually provided.

---

### Fix 5 — To Do Column Border

**Debugging Process:** Inspected the Tailwind CSS classes applied to each column card and identified the colour conflict.

**Prompt Used:** Fix the To Do column so its dashed border is visible.

**Final Solution:** Split the column styling into separate background and border colour classes so the dashed border uses a different colour from the background, making it visible.

---

### Fix 6 — Empty / Non-JSON Response Crash

**Debugging Process:** Added a try-catch around `response.json()` and logged the raw response body to identify the cases causing failures.

**Prompt Used:** Handle empty and non-JSON API responses to prevent runtime crash.

**Final Solution:** Added a guard that checks `response.headers.get('content-type')` before calling `.json()`, returning `null` or an empty object for non-JSON responses.

---

### Fix 7 — Duplicate Emoji Reactions

**Debugging Process:** The database showed duplicate rows for the same `[commentId, userId, emoji]` combination. Identified that rapid clicking could submit multiple in-flight requests.

**Prompt Used:** Prevent duplicate emoji reactions with an in-flight guard.

**Final Solution:** Added a `Set<string>` to track which reactions are currently in-flight. Before firing the API call, the emoji key is checked against the set. If it is already present, the click is ignored. The key is removed from the set when the API call completes (success or failure).

---

### Fix 8 — Task Board Error Banner

**Debugging Process:** Reviewed the task fetching logic and found the catch block was swallowing the error.

**Prompt Used:** Show an error banner with a retry button when the task board fails to load, instead of showing an empty board.

**Final Solution:** The catch block now sets an `error` state variable. When `error` is truthy, the component renders a visible red error banner with the error message and a "Retry" button that re-triggers the fetch.

---

### Fix 9 — Reaction Button Disabled State

**Debugging Process:** Reviewed the JSX for the reaction button and traced the boolean logic for the `disabled` prop.

**Prompt Used:** Correct the reaction button disabled state and add error recovery.

**Final Solution:** Corrected the boolean expression so buttons are disabled only while their specific emoji is in-flight. Also added error recovery so if the API call fails, the optimistic update is reverted and a toast error is shown.

---

### Fix 10 — Board-Comments GET Fallback for Old Prisma Client

**Debugging Process:** The 500 error stack trace showed `Unknown field 'pinned' for select statement` from Prisma. Identified this as a stale cached client issue during hot-reload.

**Prompt Used:** Add a fallback for the board-comments GET endpoint when the cached Prisma client is missing the pinned fields.

**Final Solution:** Wrapped the primary query (which selects `pinned` and `pinnedAt`) in a try-catch. If it throws, a fallback query omitting those fields is used instead. Both code paths return `{ comments, taskComments }` so the frontend works in both cases.

---

### Fix 11 — Board Discussion POST Input Clear on Failure

**Debugging Process:** Reviewed `handlePost` in `BoardDiscussion.tsx` and found the input clear and re-fetch were not gated on response status.

**Prompt Used:** Fix board discussion post reliability so input is only cleared and UI refreshed on successful API response.

**Final Solution:** Added `if (!response.ok) { ... return }` guard before the input clear and re-fetch logic. Also added the same pattern to the pin toggle handler.

---

### Fix 12 — @Mention Dropdown Portal

**Debugging Process:** Used browser DevTools to inspect the dropdown's computed position. Found it was rendering outside the visible area due to the parent container's `overflow: hidden`.

**Prompt Used:** Fix the @mention dropdown so it works in the board discussion area. The dropdown is being clipped by overflow hidden.

**Final Solution:** Extracted the dropdown into a shared `MentionTextarea` component that renders the suggestion list via `createPortal(dropdown, document.body)`. The dropdown is positioned with `position: fixed` using coordinates from `getBoundingClientRect()` on the textarea, completely escaping all overflow constraints in the parent tree.

---

### Fix 13 — Missing x-user-name Header

**Debugging Process:** Inspected outgoing mention email content. Found `caller.name` was `undefined`. Traced back to the middleware which did not forward the user's name.

**Prompt Used:** Pass the x-user-name header through middleware so mention emails show the correct sender name.

**Final Solution:** Updated `src/middleware.ts` to read `session.name` and set it as `x-user-name` on the forwarded request. Updated `src/lib/session.ts` to include `name` in the `RequestUser` type and read it from `x-user-name`.

---

### Fix 14 — Missing Prisma Migration for pinned/pinnedAt

**Debugging Process:** The `P2022` Prisma error message directly named the missing column. Checked the migrations folder and confirmed no migration existed for those fields.

**Prompt Used:** Add the missing migration for pinned and pinnedAt columns on board_comments.

**Final Solution:** Ran `npx prisma migrate dev --name add_pinned_to_board_comments` to generate and apply the SQL migration. The migration added `pinned BOOLEAN NOT NULL DEFAULT false` and `pinnedAt TIMESTAMP` columns to the `board_comments` table.

---

### Fix 15 — Pin State Resetting (Decoupled Board/Task Comment Fetches)

**Debugging Process:** Added logging to the GET endpoint and traced the state flow. Found the `Promise.all` was failing silently and replacing the entire response with an error object that had no `comments` field.

**Prompt Used:** Fix the pin state resetting when the task activity feed fails to load. Board comments and task comments should be fetched independently.

**Final Solution:** Split the `Promise.all` into two independent `try-catch` blocks. Board comments and task comments are fetched and serialised separately. A failure in one does not affect the other. The response always returns `{ comments: [...], taskComments: [...] }` with whichever data successfully loaded.

---

### Fix 16 — Past Due Date Validation

**Debugging Process:** Reproduced the issue by submitting a task with a past date. Confirmed neither the date input nor the API rejected it.

**Prompt Used:** Prevent users from setting past due dates in task creation and editing. Add both UI and server-side validation.

**Final Solution:**
- Added `min={new Date().toISOString().split('T')[0]}` to both date inputs in `TaskModal.tsx` so the browser calendar blocks past dates.
- Added server-side validation in `POST /api/tasks` and `PATCH /api/tasks/[id]` that parses the provided `dueDate`, compares it to today (midnight), and returns HTTP 422 if it is in the past.

---

### Fix 17 — Admin Self-Deactivation Guard

**Debugging Process:** Tested the user deactivation flow by attempting to deactivate the currently logged-in admin account. Confirmed it succeeded without error.

**Prompt Used:** Prevent an admin from deactivating their own account through the user management panel.

**Final Solution:** Added a guard in `PATCH /api/admin/users/[id]` that compares the target user's `id` with the authenticated caller's `id` (from `x-user-id` header). If they match and the request includes a `status` change, the endpoint returns HTTP 403 with the message `"You cannot change your own status"`.

---

## 6. Bug-to-Fix Mapping Table

| Feature | Bug / Problem | Cause | Final Fix |
|---------|--------------|-------|-----------|
| Database Setup | Seed crashes: DATABASE_URL undefined | `dotenv` loaded after `PrismaClient` import | Move `dotenv/config` to first line of seed.ts |
| Database Setup | Prisma can't find datasource URL | Prisma v7 requires explicit `url = env(...)` in schema | Added `url = env("DATABASE_URL")` to schema datasource block |
| Database Setup | Prisma runtime driver error | Prisma v7 requires explicit pg adapter | Passed `@prisma/adapter-pg` to PrismaClient constructor |
| Task API | 400 error creating unassigned task | Validation rejected null `assignedUserId` | Allow null in task creation validation |
| Kanban Board UI | To Do column border invisible | Background and border CSS classes conflicted | Split into separate bg/border colour classes |
| General API | Runtime crash on empty/non-JSON response | `.json()` called unconditionally | Guard with content-type check before parsing |
| Reactions | Duplicate reactions submitted | No in-flight guard on reaction requests | Added in-flight `Set` to block concurrent identical requests |
| Task Board | Empty board shown on fetch failure | Error was silently swallowed | Set error state; render banner with Retry button |
| Reactions | Reaction button disabled state inverted | Boolean expression negated incorrectly | Corrected the `disabled` prop logic |
| Board Discussion | GET 500 after pin schema change | Stale cached Prisma client missing new fields | Added try-catch fallback query omitting pinned fields |
| Board Discussion | Input cleared even when POST fails | Clear/re-fetch not gated on `response.ok` | Added `if (!response.ok) return` guard |
| @Mention | Dropdown invisible in board area | Clipped by `overflow: hidden` on parent container | Rendered dropdown via `createPortal` at `document.body` with `position: fixed` |
| @Mention Emails | "undefined mentioned you" in email | Middleware not forwarding `x-user-name` | Added `x-user-name` injection in middleware; added `name` to RequestUser |
| Pin Comments | P2022 column not found on POST | `pinned`/`pinnedAt` fields in schema but migration never run | Generated and applied Prisma migration for those columns |
| Pin Comments | Pin state resets after task interaction | `Promise.all` failure in GET wiped board comment state | Decoupled board and task comment fetches into independent try-catch blocks |
| Task Due Dates | Past dates accepted | No min-date validation in UI or API | Added `min=today` to date input; added server-side 422 validation |
| User Management | Admin could deactivate own account | No self-edit guard on status field | Added guard comparing target ID to caller ID; return 403 on match |

---

## 7. Feature Evolution Diagram

```
Task Management System – Version 1
│
├── Phase 1: Foundation (March 12, 2026)
│   ├── Project Scaffold
│   │   ├── Next.js 16 + TypeScript
│   │   ├── PostgreSQL + Prisma 7
│   │   ├── Tailwind CSS v4
│   │   └── Database Schema (User, Task, Comment, BoardComment, BoardReaction)
│   │
│   ├── Authentication System
│   │   ├── JWT Sessions (30-day, httpOnly cookies)
│   │   ├── bcrypt Password Hashing
│   │   ├── Login Endpoint
│   │   └── Route Protection Middleware
│   │
│   ├── Admin User Management API
│   │   ├── User CRUD Endpoints
│   │   ├── Email Invite Flow
│   │   └── Role Enforcement
│   │
│   └── Task Board & Comments API
│       ├── Task CRUD
│       ├── Kanban Status Update Endpoint
│       └── Threaded Comments (2-level max)
│
├── Phase 2: Core Frontend (March 13, 2026)
│   ├── Jira-Inspired UI
│   │   ├── Login Page (split-panel design)
│   │   ├── Sidebar Dashboard Layout
│   │   ├── Kanban Board (drag-and-drop via @dnd-kit)
│   │   ├── List View (search + filter)
│   │   ├── Task Modal (create/edit)
│   │   ├── Comment Section (threaded replies)
│   │   └── User Management Table
│   │
│   ├── Invite Flow & Magic Link Login
│   │   ├── Accept Invite Page
│   │   ├── Magic Link Page
│   │   ├── Tabbed Login (Password / Magic Link)
│   │   └── Invite Revocation UI
│   │
│   ├── Login Page Visual Polish
│   │   ├── Gradient background + feature pills
│   │   └── To Do column dashed border fix
│   │
│   └── Multi-Assignee, Board Discussion, Sortable Tables, Profile Page
│       ├── TaskAssignee join table (max 5)
│       ├── AvatarGroup component
│       ├── BoardDiscussion panel
│       ├── Sortable list view columns
│       └── Profile page (name, password, task stats)
│
├── Phase 3: Enrichment (March 13, 2026 cont.)
│   ├── Profile Photo Upload
│   │   ├── Drag-and-drop upload zone
│   │   ├── sharp resize → 256×256 WebP
│   │   └── Avatar stored as base64 in DB
│   │
│   ├── Consistent Avatar Display
│   │   └── Profile photos shown across all UI locations
│   │
│   └── Emoji Reactions + Optimistic UI + My Tasks Badge
│       ├── 6 emoji reactions per board comment
│       ├── Optimistic update with rollback on error
│       └── My Tasks sidebar badge
│
├── Phase 4: Advanced Features (March 16, 2026)
│   ├── Pagination (List View)
│   │   ├── 10 tasks per page
│   │   └── Page resets on filter change
│   │
│   ├── Task Activity Feed
│   │   ├── Comments shown inside TaskModal
│   │   └── Pinned comments sorted first
│   │
│   ├── Pin Comments
│   │   ├── Pin top-level task comments
│   │   ├── Pin board discussion comments
│   │   └── Optimistic pin toggle with revert
│   │
│   ├── @Mention Support & Email Notifications
│   │   ├── MentionTextarea with portal dropdown
│   │   ├── Keyboard navigation (↑↓ Enter Esc)
│   │   ├── Blue highlight chips for mentions
│   │   └── Email notification to mentioned users
│   │
│   ├── JIRA-Style Task Modal Redesign
│   │   ├── Two-column edit layout
│   │   ├── Activity always visible in modal
│   │   └── Live status badge + priority dot in header
│   │
│   ├── Toast Notifications (Sonner)
│   │   └── Success/error toasts on every mutation
│   │
│   ├── Confirm Dialogs
│   │   └── Replaced all browser confirm() calls
│   │
│   └── Full Task Activity CRUD
│       ├── Reply, Pin, Edit, Delete per comment
│       ├── Role-based action visibility
│       └── Auto-expand replies after posting
│
└── Phase 5: Validation & Safety (March 16, 2026)
    ├── Past Due Date Prevention
    │   ├── min=today on date inputs
    │   └── Server-side 422 validation
    │
    └── Admin Self-Deactivation Guard
        └── 403 if admin tries to change own status
```

---

## 8. Final System Features

The following features were successfully implemented in **Task Management System Version 1**:

### Authentication
- Email and password login with bcrypt-hashed credentials
- Magic link (passwordless) login with 15-minute token expiry
- JWT-based sessions with 30-day lifetime and secure httpOnly cookies
- Email invitation flow with 48-hour invite token
- Accept invite page with live password requirements checklist and auto-login
- Invite revocation (clears token, resets user to pending)
- Role-based access control (admin vs member)
- Route protection middleware on all dashboard and API routes

### Task Management
- Create, read, update, and delete tasks
- Task fields: title, description, status, priority, due date, multi-assignees
- Four statuses: To Do, In Progress, In Review, Done
- Four priority levels: Low, Medium, High, Critical
- Kanban board with drag-and-drop between status columns
- List view with sortable columns (title, status, priority, due date, assignees, created)
- Search and status filter on list view
- Pagination in list view (10 tasks per page)
- Multi-assignee support (up to 5 users per task) with stacked avatar display
- Past due date prevention (UI minimum and server-side 422 validation)
- JIRA-style two-column task edit modal

### Comments & Discussion
- Threaded task comments (replies one level deep)
- Task Activity feed inside the task modal
- Reply, Pin, Edit, and Delete actions per comment (role-based visibility)
- Pinned comments sorted to the top
- Optimistic pin toggle with revert on failure
- Team-wide Board Discussion panel with threaded replies
- Emoji reactions on board comments (👍 ❤️ 🎉 🔥 😂 🙌) with optimistic updates
- Pin board discussion comments
- @mention support with keyboard-navigable dropdown in both discussion areas
- Email notifications sent to mentioned users (with sender name and quoted content)

### User Management
- Admin user table with full CRUD (create, edit, delete)
- User status lifecycle: Pending → Invited → Active
- Deactivate and reactivate users
- Admin self-deactivation guard
- Per-status context-sensitive action buttons

### User Profile
- Edit display name
- Change password (requires current password)
- Upload profile photo with drag-and-drop (resized to 256×256 WebP)
- Remove profile photo
- Task summary stats (total tasks, by status)
- Profile photos displayed consistently across all avatar locations

### UI/UX
- Jira-inspired visual design throughout
- Collapsible sidebar with My Tasks badge
- Toast notifications (Sonner) on every mutation — success and error
- Confirm dialog component replacing all browser `confirm()` calls
- Visible error banners with Retry buttons on load failures
- Responsive design with mobile-friendly layout

---

*This document was generated on 16 March 2026 based on the complete development history of Task Management System Version 1 as recorded in the project's git commit log and codebase.*
