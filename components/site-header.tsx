import Link from "next/link";
import { Compass, LayoutDashboard, Map } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";
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

  return (
    <header className="site-header">
      <div className="nav-container">
        <Link href="/" className="brand" aria-label="Masarak home">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          <span>
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
        </nav>

        <div className="header-auth-actions">
          {user ? (
            <>
              <Link href="/profile" className="button-secondary">
                {displayName}
              </Link>

              <form action={signOutAction}>
                <button type="submit" className="button-primary">
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