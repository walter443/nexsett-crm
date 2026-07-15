import { randomUUID } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { isAllowedEmail, siteUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationEvent = "commission_review_requested" | "commission_review_completed";

export interface NotificationOutboxRow {
  id: string;
  event_type: NotificationEvent;
  prospect_id: string;
  recipient_email: string;
  recipient_name: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
}

export interface DeliverySummary {
  configured: boolean;
  claimed: number;
  sent: number;
  failed: number;
}

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

let transport: Transporter | null = null;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function commissionReviewUrl(prospectId: string): string {
  const url = new URL("/", siteUrl);
  url.searchParams.set("prospect", prospectId);
  url.searchParams.set("review", "commission");
  return url.toString();
}

function detailRow(label: string, value: string): string {
  if (!value) return "";
  return `<tr><td style="padding:5px 14px 5px 0;color:#667386;vertical-align:top">${escapeHtml(label)}</td><td style="padding:5px 0;color:#17202b;font-weight:600">${escapeHtml(value)}</td></tr>`;
}

function frame(recipientName: string, title: string, introduction: string, rows: string, actionLabel: string, actionUrl: string): string {
  const greeting = recipientName ? `Hello ${escapeHtml(recipientName)},` : "Hello,";
  return `<!doctype html>
<html><body style="margin:0;background:#edf2f6;color:#17202b;font-family:Arial,sans-serif">
  <div style="max-width:650px;margin:0 auto;padding:28px 16px">
    <div style="background:#ffffff;border:1px solid #dce3ea;border-radius:14px;overflow:hidden">
      <div style="background:#0099ff;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:700">Nexsett CRM</div>
      <div style="padding:24px">
        <p style="margin:0 0 16px">${greeting}</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${escapeHtml(title)}</h1>
        <p style="margin:0 0 18px;color:#435064;line-height:1.55">${escapeHtml(introduction)}</p>
        <table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 22px">${rows}</table>
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:9px;background:#0099ff;color:#ffffff;padding:11px 17px;font-weight:700;text-decoration:none">${escapeHtml(actionLabel)}</a>
        <p style="margin:20px 0 0;color:#667386;font-size:12px;line-height:1.5">This secure link requires an authorised Nexsett Google Workspace account. If you were not expecting this message, contact a Nexsett administrator.</p>
      </div>
    </div>
  </div>
</body></html>`;
}

export function renderNotification(row: NotificationOutboxRow): RenderedNotification {
  const payload = row.payload || {};
  const reference = oneLine(asString(payload.referenceCode)) || "Prospect";
  const organisation = oneLine(asString(payload.organisation)) || "Unnamed prospect";
  const link = commissionReviewUrl(row.prospect_id);
  const revenue = money(payload.expectedAnnualNetRevenue);

  if (row.event_type === "commission_review_requested") {
    const requester = oneLine(asString(payload.requesterName)) || "A salesperson";
    const suggested = oneLine(asString(payload.suggestedCategoryName)) || "For administrator to determine";
    const notes = asString(payload.requestNotes).trim() || "No additional request notes were supplied.";
    const subject = oneLine(`Commission review required — ${reference} ${organisation}`);
    const title = `Commission review required for ${organisation}`;
    const introduction = `${requester} has submitted a prospect for commission review. Please confirm the category, rates and allocation before recording a decision.`;
    const rows = [
      detailRow("Reference", reference),
      detailRow("Expected annual Net Revenue", revenue),
      detailRow("Suggested category", suggested),
      detailRow("Request notes", notes)
    ].join("");
    return {
      subject,
      text: [
        row.recipient_name ? `Hello ${row.recipient_name},` : "Hello,",
        "",
        title,
        introduction,
        "",
        `Reference: ${reference}`,
        `Expected annual Net Revenue: ${revenue}`,
        `Suggested category: ${suggested}`,
        `Request notes: ${notes}`,
        "",
        `Review commission request: ${link}`,
        "",
        "This link requires an authorised Nexsett Google Workspace account."
      ].join("\n"),
      html: frame(row.recipient_name, title, introduction, rows, "Review commission request", link)
    };
  }

  if (row.event_type === "commission_review_completed") {
    const status = asString(payload.reviewStatus) === "Rejected" ? "Rejected" : "Approved";
    const reviewer = oneLine(asString(payload.reviewerName)) || "An authorised approver";
    const category = oneLine(asString(payload.approvedCategoryName)) || (status === "Approved" ? "Recorded in the CRM" : "Not assigned");
    const notes = asString(payload.reviewNotes).trim() || "No additional decision notes were supplied.";
    const statusLower = status.toLowerCase();
    const subject = oneLine(`Commission review ${statusLower} — ${reference} ${organisation}`);
    const title = `Commission review ${statusLower} for ${organisation}`;
    const introduction = `${reviewer} has ${statusLower} the commission request. The CRM contains the authoritative decision and current terms.`;
    const rows = [
      detailRow("Reference", reference),
      detailRow("Decision", status),
      detailRow("Commission category", category),
      detailRow("Decision notes", notes)
    ].join("");
    return {
      subject,
      text: [
        row.recipient_name ? `Hello ${row.recipient_name},` : "Hello,",
        "",
        title,
        introduction,
        "",
        `Reference: ${reference}`,
        `Decision: ${status}`,
        `Commission category: ${category}`,
        `Decision notes: ${notes}`,
        "",
        `Open prospect: ${link}`,
        "",
        "This link requires an authorised Nexsett Google Workspace account."
      ].join("\n"),
      html: frame(row.recipient_name, title, introduction, rows, "Open prospect", link)
    };
  }

  throw new Error("Unsupported notification event");
}

function smtpSettings(): SmtpSettings | null {
  const user = process.env.SMTP_USER?.trim() || "";
  const password = process.env.SMTP_PASS || "";
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL?.trim() || user;
  if (!user || !password || !fromEmail) return null;
  if (!isAllowedEmail(fromEmail)) {
    throw new Error("NOTIFICATION_FROM_EMAIL must use the approved Nexsett Workspace domain");
  }
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port");
  }
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    user,
    password,
    fromName: oneLine(process.env.NOTIFICATION_FROM_NAME?.trim() || "Nexsett Information"),
    fromEmail
  };
}

function getTransport(settings: SmtpSettings): Transporter {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port !== 465,
    auth: { user: settings.user, pass: settings.password },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true
  });
  return transport;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown email delivery error";
  return oneLine(message).slice(0, 2_000);
}

function retryAt(attempts: number): string {
  const minutes = Math.min(60, Math.max(2, 2 ** Math.max(1, attempts)));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function deliverPendingNotifications(batchSize = 20): Promise<DeliverySummary> {
  const settings = smtpSettings();
  if (!settings) return { configured: false, claimed: 0, sent: 0, failed: 0 };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_batch", {
    p_batch_size: Math.min(Math.max(batchSize, 1), 100),
    p_worker_id: randomUUID()
  });
  if (error) throw new Error(`Notification queue claim failed: ${error.message}`);

  const rows = (data || []) as NotificationOutboxRow[];
  const summary: DeliverySummary = { configured: true, claimed: rows.length, sent: 0, failed: 0 };
  const mailer = getTransport(settings);

  for (const row of rows) {
    try {
      const message = renderNotification(row);
      await mailer.sendMail({
        from: { name: settings.fromName, address: settings.fromEmail },
        to: { name: oneLine(row.recipient_name), address: row.recipient_email },
        subject: message.subject,
        text: message.text,
        html: message.html
      });
      const { error: updateError } = await admin
        .from("notification_outbox")
        .update({
          delivery_status: "Sent",
          sent_at: new Date().toISOString(),
          locked_at: null,
          worker_id: null,
          last_error: ""
        })
        .eq("id", row.id);
      if (updateError) throw new Error(`Delivery receipt could not be recorded: ${updateError.message}`);
      summary.sent += 1;
    } catch (deliveryError) {
      summary.failed += 1;
      await admin
        .from("notification_outbox")
        .update({
          delivery_status: "Failed",
          last_error: errorMessage(deliveryError),
          next_attempt_at: retryAt(row.attempts),
          locked_at: null,
          worker_id: null
        })
        .eq("id", row.id);
    }
  }

  return summary;
}

export async function deliverNotificationsBestEffort(batchSize = 10): Promise<DeliverySummary | null> {
  try {
    return await deliverPendingNotifications(batchSize);
  } catch {
    return null;
  }
}
