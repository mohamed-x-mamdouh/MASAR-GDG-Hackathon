import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Compass } from "lucide-react";
import "./globals.css";

import { LearningProgressProvider } from "@/components/learning-progress-provider";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "Masarak — Your learning journey, made clear",
    template: "%s | Masarak",
  },
  description:
    "A structured Full-Stack learning roadmap for university students in Egypt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={
            <header className="site-header" aria-label="Loading navigation" />
          }
        >
          <SiteHeader />
        </Suspense>

        <main>
          <Suspense
            fallback={
              <div className="mx-auto max-w-3xl px-6 py-12">
                Loading page...
              </div>
            }
          >
            <LearningProgressProvider>{children}</LearningProgressProvider>
          </Suspense>
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
