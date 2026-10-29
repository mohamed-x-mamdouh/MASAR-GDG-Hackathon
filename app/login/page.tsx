
import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Sign in | Masar",
  description: "Sign in to your Masar learning account.",
};

export default function LoginPage() {
  return (
    <main className="page-container auth-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Sign in</span>
      </div>

      <AuthForm mode="login" />
    </main>
  );
}
