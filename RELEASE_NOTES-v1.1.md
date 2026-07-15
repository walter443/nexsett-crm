# Nexsett CRM v1.1.0 — Commission Review Workflow

## New in this version

- Sales can request commission consideration while protected commission fields remain locked.
- A dedicated **Commission reviews** queue shows Walter and other authorised approvers the requests within their record scope.
- Request emails are sent from `Nexsett Information <info@nexsett.com>` with a direct protected link to the prospect.
- Approvers assign the actual commission category and terms, then approve or reject with decision notes.
- The requester receives an Approved/Rejected outcome email.
- Requester, reviewer, timestamps and review iterations are recorded in the database and audit history.
- Changing approved commission terms requires reopening the review.
- A server-only outbox retries temporary email failures up to five times.

## Upgrade from v1.0

1. Back up the Supabase project.
2. Apply `supabase/migrations/202607150001_commission_review_notifications.sql` once.
3. Add the seven workflow email/retry environment settings listed in `.env.example`.
4. Deploy v1.1.
5. Complete the workflow test in `SETUP.md` before enabling it for the full team.

The original v1.0 package and standalone browser edition are not modified by this release.
