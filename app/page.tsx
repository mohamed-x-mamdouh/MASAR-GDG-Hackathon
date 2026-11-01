
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import HomePageClient from "@/components/home-page-client";

export default async function HomePage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasChosenStartPath = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_start_path")
      .eq("id", user.id)
      .maybeSingle();

    hasChosenStartPath = Boolean(
      profile?.selected_start_path
    );
  }

  const primaryHref = !user
    ? "/signup"
    : hasChosenStartPath
      ? "/dashboard"
      : "/onboarding";

  const primaryLabel = !user
    ? "أنشئ حسابك"
    : hasChosenStartPath
      ? "كمل رحلتك"
      : "حدد نقطة بدايتك";

  const assessmentHref = user
    ? "/onboarding/assessment"
    : "/signup";

  const assessmentLabel = user
    ? "قيّم مهاراتك"
    : "أنشئ حسابًا لتقييم مهاراتك";

  return (
    <HomePageClient
      primaryHref={primaryHref}
      primaryLabel={primaryLabel}
      assessmentHref={assessmentHref}
      assessmentLabel={assessmentLabel}
    />
  );
}
