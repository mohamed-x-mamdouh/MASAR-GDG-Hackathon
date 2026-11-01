import Link from "next/link";
import { LayoutDashboard, Map, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";
import Image from "next/image";
import logo from "../public/masarak-logo-transparent.png";
import { connection } from "next/server";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
];

export default async function SiteHeader() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "My Profile";

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
  }

  return (
    <header className="site-header">
      <div className="nav-container">
        <Link href="/" className="brand" aria-label="Masarak home">
          <span className="brand-logo">
            <Image src={logo} alt="Masarak logo" width={150} height={43} />
          </span>
          <span className="brand-name">
            Masarak<span className="brand-period">.</span>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="nav-link">
              <Icon size={17} />
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="nav-link">
              <Settings2 size={17} />
              Admin
            </Link>
          )}
        </nav>

        <div className="header-auth-actions">
          {user ? (
            <>
              <Link
                href="/profile"
                className="button-secondary header-profile-link"
              >
                {displayName}
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="button-primary header-signout">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="button-secondary">
                Sign in
              </Link>
              <Link href="/signup" className="button-primary">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
