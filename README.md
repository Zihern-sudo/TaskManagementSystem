# RIO Task — Task Management System

A production-ready, full-stack task management application inspired by JIRA, built with the modern Next.js App Router stack.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, TypeScript) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) |
| ORM | [Prisma](https://www.prisma.io/) |
| Authentication | [NextAuth.js v5 (Auth.js)](https://authjs.dev/) |
| Password hashing | [bcryptjs](https://github.com/dcodeIO/bcrypt.js) |
| Email | [Nodemailer](https://nodemailer.com/) |

---

## Features

- **User authentication** — email/password login, magic-link sign-in, email invitation flow
- **Role-based access control** — `admin` and `member` roles
- **User management** — account statuses: `pending`, `invited`, `active`
- **Task management board** — Kanban-style board with statuses and priorities
- **Threaded comments** — nested comment replies on tasks

---

## Database Schema

### User
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `fullName` | String | |
| `email` | String | Unique |
| `password` | String | Bcrypt-hashed |
| `role` | Enum | `admin` \| `member` |
| `status` | Enum | `pending` \| `invited` \| `active` |
| `inviteToken` | String? | For email invitation flow |
| `inviteTokenExpiry` | DateTime? | |
| `magicLinkToken` | String? | For magic-link login |
| `magicLinkExpiry` | DateTime? | |

### Task
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `title` | String | |
| `description` | String? | |
| `status` | Enum | `not_started` \| `in_progress` \| `in_review` \| `completed` |
| `priority` | Enum | `low` \| `medium` \| `high` \| `critical` |
| `dueDate` | DateTime? | |
| `assignedUserId` | String? | FK → User |

### Comment
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `content` | String | |
| `taskId` | String | FK → Task (cascade delete) |
| `authorId` | String | FK → User (cascade delete) |
| `parentId` | String? | FK → Comment (self-referential, for replies) |

---

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later
- **PostgreSQL** v14 or later (running locally or accessible remotely)

---

## Setup

### 1. Clone & install dependencies

```bash
git clone <repository-url>
cd TaskManagementSystem
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and update the values:

```dotenv
# PostgreSQL connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/rio_task?schema=public"

# NextAuth secret — generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# SMTP settings for email invitations and magic links
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="noreply@example.com"
SMTP_PASS="smtp-password"
SMTP_FROM="RIO Task <noreply@example.com>"
```

### 3. Create the database

If you don't have a `rio_task` database yet:

```bash
psql -U postgres -c "CREATE DATABASE rio_task;"
```

### 4. Run database migrations

```bash
npm run db:migrate
```

This creates all tables according to `prisma/schema.prisma`.

### 5. Seed the database

```bash
npm run db:seed
```

This creates the default admin account:

| Field | Value |
|---|---|
| Email | `admin@taskmanager.com` |
| Password | `Admin@1234` |

### 6. Generate Prisma client (if needed)

```bash
npm run db:generate
```

---

## Running the Application

### Development

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm run start
```

---

## Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply pending Prisma migrations |
| `npm run db:push` | Push schema changes without migrations (dev only) |
| `npm run db:seed` | Seed the database with the default admin |
| `npm run db:reset` | Reset the database and re-apply all migrations |
| `npm run db:studio` | Open Prisma Studio (visual DB explorer) |
| `npm run db:generate` | Regenerate the Prisma client |

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Database seeder
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts   # NextAuth.js route handler
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── lib/
│   │   ├── auth.ts          # NextAuth.js configuration
│   │   ├── db.ts            # Prisma client singleton
│   │   └── mail.ts          # Nodemailer helpers
│   │
│   └── types/
│       └── next-auth.d.ts   # NextAuth.js type augmentation
│
├── .env.example             # Environment variable template
├── next.config.ts
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

---

## Default Admin Credentials

> These credentials are created by the seed script and should be changed immediately after first login in production.

| | |
|---|---|
| **Email** | `admin@taskmanager.com` |
| **Password** | `Admin@1234` |
