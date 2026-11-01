
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  Home,
} from "lucide-react";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة",
};

export default function NotFound() {
  return (
    <div className="page-container mas-state-page">
      <section className="panel mas-state-card">
        <span className="mas-state-code" dir="ltr">
          404
        </span>

        <h1>الصفحة اللي بتدور عليها مش موجودة</h1>

        <p>
          يمكن اللينك قديم أو فيه خطأ في الكتابة.
          ارجع للرئيسية أو افتح خريطة المسار وكمل رحلتك.
        </p>

        <div className="dashboard-actions">
          <Link href="/" className="button-primary">
            <Home size={17} />
            الرئيسية
          </Link>

          <Link href="/roadmap" className="button-secondary">
            <Compass size={17} />
            خريطة المسار
            <ArrowLeft size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
