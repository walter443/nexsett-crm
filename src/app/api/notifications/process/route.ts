import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverPendingNotifications } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Notification retry worker is not configured." }, { status: 503 });
  }
  if (!validCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const summary = await deliverPendingNotifications(50);
    if (!summary.configured) {
      return NextResponse.json({ error: "SMTP delivery is not configured." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
