import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");

  const allowedDestinations = [
    "/onboarding",
    "/dashboard",
  ];

  const next =
    requestedNext &&
    allowedDestinations.includes(requestedNext)
      ? requestedNext
      : "/onboarding";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login", requestUrl.origin),
    );
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed:", error);

    return NextResponse.redirect(
      new URL("/login", requestUrl.origin),
    );
  }

  return NextResponse.redirect(
    new URL(next, requestUrl.origin),
  );
}