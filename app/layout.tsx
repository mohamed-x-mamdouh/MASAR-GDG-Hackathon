import type { Metadata } from "next";
import Link from "next/link";
import { Compass, LayoutDashboard, Map, ArrowUpRight } from "lucide-react";
import "./globals.css";
import { LearningProgressProvider } from "@/components/learning-progress-provider";

export const metadata: Metadata = {
  title: {
    default: "Masarak — Your learning journey, made clear",
    template: "%s | Masarak",
  },
  description:
    "A structured Full-Stack learning roadmap for university students in Egypt.",
};

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
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
              <Link href="/login" className="button-secondary">
                Sign in
              </Link>

              <Link href="/signup" className="button-primary">
                Create account
              </Link>
            </div>
          </div>
        </header>

        <main>
          <LearningProgressProvider>{children}</LearningProgressProvider>
        </main>

        <footer className="site-footer">
          <div className="footer-inner">
            <Link href="/" className="brand footer-brand">
              <span className="brand-mark">
                <Compass size={19} />
              </span>
              <span>
                Masarak<span className="brand-period">.</span>
              </span>
            </Link>
            <p>A clearer path from learning to building.</p>
            <span>Built for the next generation of developers.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
