import { redirect } from "next/navigation";
import { LoginCard } from "@/components/login-card";
import { allowedWorkspaceDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.status === "Active") redirect("/");
  }

  const params = await searchParams;
  const invited = params.invited === "1";
  const errorCode = typeof params.error === "string" ? params.error : "";
  const errorMessages: Record<string, string> = {
    workspace: `Use a managed ${allowedWorkspaceDomain} Google Workspace account.`,
    uninvited: "This account has not been invited or has been suspended.",
    callback: "Google sign-in could not be completed. Please try again."
  };

  return (
    <LoginCard
      domain={allowedWorkspaceDomain}
      invited={invited}
      error={errorMessages[errorCode] || ""}
    />
  );
}
