import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", siteUrl), { status: 303 });
}
