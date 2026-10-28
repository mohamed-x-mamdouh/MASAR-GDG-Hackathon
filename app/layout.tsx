
import type { Metadata } from "next";
import Link from "next/link";
import { Compass, LayoutDashboard, Map, ArrowUpRight } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Masar — Your learning journey, made clear",
    template: "%s | Masar",
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
            <Link href="/" className="brand" aria-label="Masar home">
              <span className="brand-mark">
                <Compass size={22} />
              </span>
              <span>masar<span className="brand-period">.</span></span>
            </Link>

            <nav className="main-nav" aria-label="Main navigation">
              {navigation.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="nav-link">
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </nav>

            <Link href="/roadmap" className="nav-cta">
              Start learning <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="footer-inner">
            <Link href="/" className="brand footer-brand">
              <span className="brand-mark">
                <Compass size={19} />
              </span>
              <span>masar<span className="brand-period">.</span></span>
            </Link>
            <p>A clearer path from learning to building.</p>
            <span>Built for the next generation of developers.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
