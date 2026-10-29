"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/lib/auth-form-state";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const displayName = String(
    formData.get("displayName") ?? "",
  ).trim();

  const email = String(
    formData.get("email") ?? "",
  ).trim().toLowerCase();

  const password = String(
    formData.get("password") ?? "",
  );

  if (!displayName || !email || !password) {
    return { error: "Please complete all fields." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < 8) {
    return {
      error: "Your password must be at least 8 characters.",
    };
  }

  const supabase = await createClient();
  const siteUrl = getSiteUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
      emailRedirectTo:
        `${siteUrl}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return {
      error:
        error.message === "User already registered"
          ? "This account may already exist. Try signing in instead."
          : error.message,
    };
  }

  if (data.session) {
    redirect("/onboarding");
  }

  return {
    message:
      "Account created. Check your email to confirm your address, then choose how you want to start.",
  };
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(
    formData.get("email") ?? "",
  ).trim().toLowerCase();

  const password = String(
    formData.get("password") ?? "",
  );

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error || !data.user) {
    return {
      error:
        "Unable to sign in. Check your details and confirm your email.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("selected_start_path")
      .eq("id", data.user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "Couldn't load the user's onboarding path:",
      profileError,
    );

    redirect("/onboarding");
  }

  if (!profile?.selected_start_path) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}