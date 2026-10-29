import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard-client";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Student Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("selected_start_path")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.selected_start_path) {
    redirect("/onboarding");
  }

  return <DashboardClient />;
}