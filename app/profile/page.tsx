import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    "Student";

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <p className="mt-2 text-gray-500">
        Manage your Masarak account.
      </p>

      <section className="mt-8 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">
          Account Information
        </h2>

        <div className="mt-6 space-y-5">
          <div>
            <p className="text-sm text-gray-500">Full Name</p>
            <p className="font-medium">{displayName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
        </div>
      </section>
    </div>
  );
}