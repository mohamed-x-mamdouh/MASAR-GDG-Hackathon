
"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function Error({
  error,
  unstable_retry,
}: ErrorProps) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="page-container mas-state-page">
      <section className="panel mas-state-card">
        <span className="mas-state-code" dir="ltr">
          <TriangleAlert size={34} />
        </span>

        <h1>حصلت مشكلة في عرض الصفحة</h1>

        <p>
          مش مشكلة من عندك. حصل خطأ غير متوقع أثناء تحميل
          الصفحة. جرّب تاني، ولو المشكلة استمرت ارجع للرئيسية.
        </p>

        <div className="dashboard-actions">
          <button
            type="button"
            className="button-primary"
            onClick={unstable_retry}
          >
            <RefreshCw size={17} />
            جرّب تاني
          </button>

          <Link href="/" className="button-secondary">
            الرئيسية
            <ArrowLeft size={17} />
          </Link>
        </div>

        {error.digest && (
          <p className="mas-state-reference" dir="ltr">
            Reference: {error.digest}
          </p>
        )}
      </section>
    </div>
  );
}
