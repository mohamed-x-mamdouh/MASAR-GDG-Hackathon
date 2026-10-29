
import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create account | Masar",
  description: "Create your Masar learning account.",
};

export default function SignupPage() {
  return (
    <main className="page-container auth-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Create account</span>
      </div>

      <AuthForm mode="signup" />
    </main>
  );
}
