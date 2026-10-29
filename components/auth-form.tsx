
"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  signInAction,
  signUpAction,
} from "@/app/auth/actions";
import type { AuthActionState } from "@/lib/auth-form-state";

type AuthFormProps = {
  mode: "signup" | "login";
};

const initialState: AuthActionState = {};

export default function AuthForm({ mode }: AuthFormProps) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, isPending] = useActionState(
    action,
    initialState,
  );

  const isSignUp = mode === "signup";

  return (
    <section className="auth-card">
      <span className="eyebrow">MASAR ACCOUNT</span>

      <h1>{isSignUp ? "Create your account" : "Welcome back"}</h1>

      <p className="auth-description">
        {isSignUp
          ? "Create an account to start your learning journey and save your progress."
          : "Sign in to continue your learning journey."}
      </p>

      <form action={formAction} className="auth-form">
        {isSignUp && (
          <div className="auth-field">
            <label htmlFor="displayName">Full name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              maxLength={80}
              required
            />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {isSignUp && (
            <p className="auth-hint">Use at least 8 characters.</p>
          )}
        </div>

        {state.error && (
          <p className="auth-message auth-error" role="alert">
            {state.error}
          </p>
        )}

        {state.message && (
          <p className="auth-message auth-success" role="status">
            {state.message}
          </p>
        )}

        <button
          className="button-primary auth-submit"
          type="submit"
          disabled={isPending}
        >
          {isPending
            ? "Please wait..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="auth-switch">
        {isSignUp ? "Already have an account?" : "New to Masar?"}{" "}
        <Link href={isSignUp ? "/login" : "/signup"}>
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
