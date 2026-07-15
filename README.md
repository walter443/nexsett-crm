# Nexsett Prospect & Commission CRM — Secure Team Edition v1.1

A branded, multi-user CRM for managing prospects, commission attribution, approvals and commercial governance. This is the shared-team successor to the standalone browser edition; the standalone file remains separate and unchanged.

## What is included

- Google Workspace sign-in restricted to invited `@nexsett.com` users
- First administrator bootstrap for `walter@nexsett.com`
- Invitations sent through Supabase Auth using `info@nexsett.com`
- Sales, Manager and Admin roles, plus per-user allow/block overrides
- Own, team and all-record scopes
- Database-enforced ownership, commission and approval controls
- Sales commission-review requests without access to protected rates or decisions
- Walter/authorised-approver review queue with direct-link email alerts from `info@nexsett.com`
- Approved/rejected outcome emails to the salesperson, backed by a durable retry queue
- Versioned Commission Plans with editable categories and percentages
- Immutable commission-rule snapshots on existing prospects
- Approval gates for material or specially governed opportunities
- Append-only, scope-aware audit history
- Scoped CSV exports
- Responsive Nexsett-branded light and dark interfaces
- Security headers, server-only privileged keys and validated API payloads

## Default access model

| Capability | Sales | Manager | Admin |
|---|---:|---:|---:|
| Create/edit visible prospects | Yes | Yes | Yes |
| Request commission review | Yes | Yes | Yes |
| Reassign prospects | No | Yes | Yes |
| View commission forecasts | Yes | Yes | Yes |
| Manage commissions and approvals | No | Yes | Yes |
| Export scoped data and view audit | No | Yes | Yes |
| Delete prospects | No | No | Yes |
| Publish Commission Plans | No | No | Yes |
| Manage users and permissions | No | No | Yes |

Every capability can be explicitly allowed or blocked for an individual. A user's record scope independently controls whether they can reach their own records, their team's records, or all records.

## Technology

- Next.js 16 and React 19
- Supabase Auth and PostgreSQL
- PostgreSQL Row Level Security (RLS)
- Google Workspace SMTP through Nodemailer
- TypeScript, Zod and Vitest

## Commission review flow

1. A Sales user creates or edits a prospect, adds optional context and chooses **Request commission review on save**.
2. The request appears in the **Commission reviews** queue for authorised approvers. Walter receives every request because his Admin account has All-record scope; Managers receive only requests within their authorised scope.
3. An email from `Nexsett Information <info@nexsett.com>` links directly to the protected prospect.
4. The approver selects the actual category and terms, then approves or rejects with decision notes.
5. The decision, reviewer and time are written to audit history, and the requester receives an outcome email.
6. Failed email attempts remain in a server-only outbox and retry automatically. The CRM record remains the authoritative status even if email is delayed.

## Start here

1. Follow [SETUP.md](SETUP.md) to create the Supabase project, Google OAuth client, Google SMTP sender, notification retry worker and deployment.
2. Review [SECURITY.md](SECURITY.md) before production use.
3. Copy `.env.example` to `.env.local` and supply your own project values.

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

For local development after configuration:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Project layout

```text
src/app/                 Pages, auth callback and protected API routes
src/components/          Branded CRM interface and editors
src/lib/                 Authorization, validation and Supabase clients
supabase/migrations/     Database schema, RLS policies and security triggers
tests/                   Permission, validation and security invariant tests
```

## Important

`SUPABASE_SECRET_KEY`, `SMTP_PASS` and `CRON_SECRET` are server credentials. Store them only in the deployment provider's encrypted environment settings. Never place them in browser code, a `NEXT_PUBLIC_` variable, source control, screenshots or support messages.

This project provides a strong application-security baseline, but it is not a penetration-test report or a regulatory/compliance certification. Complete the production checklist in [SECURITY.md](SECURITY.md) and obtain independent review when required by Nexsett's risk obligations.
