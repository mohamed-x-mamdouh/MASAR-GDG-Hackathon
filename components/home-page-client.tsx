"use client";
import Image from "next/image";
import { Hub } from "@lucasmarkes/hairline/react";
import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Code2,
  Compass,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Play,
  Route,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

type HomePageClientProps = {
  primaryHref: string;
  primaryLabel: string;
  assessmentHref: string;
  assessmentLabel: string;
};

const stages = [
  {
    number: "01",
    title: "تحديد نقطة البداية",
    description:
      "افهم مستواك الحالي وحدد من أين تبدأ رحلتك.",
    status: "completed",
  },
  {
    number: "02",
    title: "أساسيات تطوير الويب",
    description:
      "ابنِ أساسًا قويًا في HTML و CSS و JavaScript.",
    status: "current",
  },
  {
    number: "03",
    title: "تطوير واجهات المستخدم",
    description:
      "انتقل إلى React وابنِ واجهات تفاعلية.",
    status: "locked",
  },
  {
    number: "04",
    title: "تطوير الأنظمة الخلفية",
    description:
      "تعلم التعامل مع الخوادم وقواعد البيانات.",
    status: "locked",
  },
] as const;

const features = [
  {
    icon: Route,
    number: "01",
    title: "مسار تعليمي واضح",
    description:
      "خريطة مترابطة توضح لك ما تتعلمه الآن، وما الخطوة التالية، ولماذا تحتاج إليها.",
  },
  {
    icon: Code2,
    number: "02",
    title: "تطبيق عملي حقيقي",
    description:
      "حوّل المعرفة إلى مهارات من خلال التطبيق والمشاريع العملية في كل مرحلة.",
  },
  {
    icon: Target,
    number: "03",
    title: "تقييم مستواك",
    description:
      "اختبر فهمك وتأكد أنك مستعد للانتقال إلى المرحلة التالية.",
  },
  {
    icon: Trophy,
    number: "04",
    title: "تابع تقدمك",
    description:
      "راقب إنجازاتك ومراحل تعلمك واعرف دائمًا أين وصلت.",
  },
];

const processSteps = [
  {
    number: "01",
    title: "حدد نقطة بدايتك",
    description:
      "ابدأ من الصفر أو قيّم مهاراتك الحالية.",
  },
  {
    number: "02",
    title: "اتبع خريطتك",
    description: "تعلم بالترتيب الصحيح دون تشتت.",
  },
  {
    number: "03",
    title: "طبّق واختبر",
    description:
      "حوّل كل مرحلة إلى معرفة ومهارة حقيقية.",
  },
  {
    number: "04",
    title: "اقترب من هدفك",
    description:
      "تقدم بخطوات واضحة نحو الاستعداد لسوق العمل.",
  },
];

function SectionLabel({
  children,
  number,
}: {
  children: React.ReactNode;
  number?: string;
}) {
  return (
    <div className="masarak-section-label">
      <span className="masarak-label-dot" />
      {number && <span>{number}</span>}
      <span>{children}</span>
    </div>
  );
}

export default function HomePageClient({
  primaryHref,
  primaryLabel,
  assessmentHref,
  assessmentLabel,
}: HomePageClientProps) {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="masarak-home" dir="rtl">
      {/* HERO */}
      <section className="masarak-hero">
        <div className="masarak-hero-orb masarak-hero-orb-one" />
        <div className="masarak-hero-orb masarak-hero-orb-two" />

        <div className="masarak-container masarak-hero-grid">
          <div className="masarak-hero-content">
            <SectionLabel>رحلتك تبدأ من هنا</SectionLabel>

            <h1 className="masarak-title-reveal">
              من أول خطوة...
              <br />
              لحد أول
              <span className="masarak-highlight"> فرصة.</span>
            </h1>

            <p className="masarak-hero-description" data-reveal>
              مسارك هو دليلك المنظم لتعلّم هندسة
              الويب، وبناء مهاراتك، والاستعداد
              الحقيقي لسوق العمل. بدل ما تضيع وقتك
              بين مصادر ومسارات كتير، اتعلم بخطة
              واضحة، وطبّق بإيدك، وقِس تطورك في كل
              مرحلة.
            </p>

            <div className="masarak-hero-actions" data-reveal>
              <Link href={primaryHref} className="masarak-btn-primary">
                {primaryLabel}
                <ArrowLeft size={18} />
              </Link>

              <Link href={assessmentHref} className="masarak-btn-secondary">
                <Play size={16} />
                {assessmentLabel}
              </Link>
            </div>

            <div className="masarak-hero-trust" data-reveal>
              <CheckCircle2 size={17} />
              <span>
                خطة واضحة. تطبيق عملي. تقدم تقدر
                تشوفه.
              </span>
            </div>
          </div>

          {/* ROADMAP PRODUCT PREVIEW */}
          <div className="masarak-hero-visual" data-reveal>
            <div className="masarak-preview-glow" />

            <div className="masarak-floating-tech masarak-floating-tech-html">
              <span>5</span> HTML
            </div>
            <div className="masarak-floating-tech masarak-floating-tech-css">
              <span>✳</span> CSS
            </div>
            <div className="masarak-floating-tech masarak-floating-tech-js">
              <span>JS</span> JavaScript
            </div>

            <div className="masarak-preview-window">
              <div className="masarak-preview-header">
                <div>
                  <span className="masarak-preview-overline">
                    LEARNING ROADMAP
                  </span>
                  <h3>رحلتك في هندسة الويب</h3>
                </div>

                <span className="masarak-preview-icon">
                  <Compass size={21} />
                </span>
              </div>

              <div className="masarak-progress-overview">
                <div>
                  <span>تقدمك في الرحلة</span>
                  <strong>25%</strong>
                </div>
                <div className="masarak-progress-track">
                  <span style={{ width: "25%" }} />
                </div>
              </div>

              <div className="masarak-stage-list">
                {stages.map((stage) => (
                  <div className="masarak-stage" key={stage.number}>
                    <div className={`masarak-stage-marker ${stage.status}`}>
                      {stage.status === "completed" ? (
                        <Check size={16} />
                      ) : stage.status === "current" ? (
                        <span />
                      ) : (
                        <LockKeyhole size={15} />
                      )}
                    </div>

                    <div className="masarak-stage-content">
                      <div className="masarak-stage-heading">
                        <span>المرحلة {stage.number}</span>
                        {stage.status === "current" && (
                          <span className="masarak-current-badge">
                            أنت هنا
                          </span>
                        )}
                      </div>

                      <h4>{stage.title}</h4>
                      <p>{stage.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="masarak-preview-footer">
                <span>
                  <Layers3 size={16} />
                  مسار تعليمي مترابط
                </span>
                <span>MASARAK.</span>
              </div>
            </div>

            <div className="masarak-floating-note">
              <span className="masarak-floating-icon">
                <Zap size={19} />
              </span>
              <div>
                <strong>خطوتك القادمة</strong>
                <span>تعلم أساسيات JavaScript</span>
              </div>
            </div>

            <div className="masarak-visual-index">01 / 04</div>
          </div>
        </div>

        <div className="masarak-container masarak-hero-bottom">
          <span>LEARN WITH PURPOSE</span>
          <span className="masarak-bottom-line" />
          <span>BUILD WITH CONFIDENCE</span>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="masarak-section masarak-problem">
        <div className="masarak-container">
          <div className="masarak-centered-heading" data-reveal>
            <SectionLabel number="01">المشكلة</SectionLabel>

            <h2>
              المشكلة مش في قلة المصادر...
              <br />
              المشكلة في <span>غياب الطريق.</span>
            </h2>

            <p>
              في رحلة تعلم البرمجة، كثرة المصادر
              مش دايمًا ميزة. أحيانًا بتكون هي
              السبب في التشتت والتوقف.
            </p>
          </div>

          <div className="masarak-problem-grid">
            <article className="masarak-problem-item" data-reveal>
              <span>01</span>
              <CircleHelp size={21} />
              <h3>مش عارف تبدأ منين</h3>
              <p>
                مجالات كتير ومصادر أكتر، لكن نقطة
                البداية مش واضحة.
              </p>
            </article>

            <article className="masarak-problem-item" data-reveal>
              <span>02</span>
              <Layers3 size={21} />
              <h3>تشتت بين الكورسات</h3>
              <p>
                تبدأ كورس وتسيبه وتنتقل لمصدر تاني
                بدون خطة.
              </p>
            </article>

            <article className="masarak-problem-item" data-reveal>
              <span>03</span>
              <Route size={21} />
              <h3>مش عارف الخطوة الجاية</h3>
              <p>
                خلصت موضوع، لكن مش عارف المفروض
                تتعلم إيه بعده.
              </p>
            </article>

            <article className="masarak-problem-item" data-reveal>
              <span>04</span>
              <Target size={21} />
              <h3>مش شايف تطورك</h3>
              <p>
                بتتعلم كتير، لكن مش عارف تقيس
                مستواك الحقيقي.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="masarak-section masarak-solution">
        <div className="masarak-container">
          <div className="masarak-solution-heading" data-reveal>
            <div>
              <SectionLabel number="02">الحل</SectionLabel>
              <h2>
                كل خطوة ليها هدف...
                <br />
                وكل مرحلة بتقربك من هدفك.
              </h2>
            </div>

            <p>
              مسارك بيحوّل رحلة التعلم من مجموعة
              خطوات عشوائية إلى تجربة منظمة، تعرف
              فيها أنت فين ورايح فين.
            </p>
          </div>

          <div className="masarak-process">
            {processSteps.map((step, index) => (
              <div
                className="masarak-process-step"
                key={step.number}
                data-reveal
              >
                <div className="masarak-process-top">
                  <span>{step.number}</span>
                  {index !== processSteps.length - 1 && (
                    <span className="masarak-process-connector" />
                  )}
                </div>

                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="masarak-section masarak-roadmap-section">
        <div className="masarak-container">
          <div className="masarak-roadmap-intro" data-reveal>
            <div>
              <SectionLabel number="03">خريطة التعلم</SectionLabel>
              <h2>
                مش مجرد قائمة كورسات...
                <br />
                دي <span>خريطة طريق كاملة.</span>
              </h2>
              <p>
                كل موضوع في مكانه الصحيح. كل مرحلة
                مبنية على اللي قبلها. وكل خطوة ليها
                هدف واضح.
              </p>
            </div>

            <Link href="/roadmap" className="masarak-text-link">
              استكشف خريطة المسار
              <ArrowLeft size={17} />
            </Link>
          </div>

          <div className="masarak-roadmap-demo" data-reveal>
            <div className="masarak-roadmap-demo-sidebar">
              <span className="masarak-demo-label">YOUR LEARNING PATH</span>
              <h3>هندسة الويب المتكاملة</h3>
              <p>
                رحلة تعليمية متدرجة من الأساسيات
                إلى بناء التطبيقات.
              </p>

              <div
                className="masarak-hairline-block"
                aria-label="تصور بصري لترابط مهارات التعلم"
              >
                <span className="masarak-hairline-caption">
                  SKILLS CONNECTION
                </span>
                <div className="masarak-hairline-wrap">
                  <Hub
                    theme="dark"
                    intensity={0.65}
                    label="Connected learning path"
                  />
                </div>
              </div>

              <div className="masarak-demo-stats">
                <div>
                  <strong>04</strong>
                  <span>مراحل تعليمية</span>
                </div>
                <div>
                  <strong>01</strong>
                  <span>مرحلة حالية</span>
                </div>
              </div>

              <Link href="/roadmap" className="masarak-btn-primary">
                عرض الخريطة
                <ArrowLeft size={16} />
              </Link>
            </div>

            <div className="masarak-roadmap-demo-content">
              {stages.map((stage) => (
                <div className="masarak-roadmap-row" key={stage.number}>
                  <div className={`masarak-roadmap-node ${stage.status}`}>
                    {stage.status === "completed" ? (
                      <Check size={16} />
                    ) : stage.status === "current" ? (
                      <span />
                    ) : (
                      <LockKeyhole size={15} />
                    )}
                  </div>

                  <div className="masarak-roadmap-row-copy">
                    <span>المرحلة {stage.number}</span>
                    <h4>{stage.title}</h4>
                    <p>{stage.description}</p>
                  </div>

                  {stage.status === "current" && (
                    <span className="masarak-active-tag">الحالية</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="masarak-section masarak-features-section">
        <div className="masarak-container">
          <div className="masarak-centered-heading" data-reveal>
            <SectionLabel number="04">تجربة التعلم</SectionLabel>
            <h2>
              اتعلم. طبّق. اختبر.
              <br />
              <span>واتقدم.</span>
            </h2>
            <p>
              مش الهدف إنك تخلص كورسات أكتر، الهدف
              إنك تبني مهارات تقدر تستخدمها فعلًا.
            </p>
          </div>

          <div className="masarak-features-grid">
            {features.map(({ icon: Icon, number, title, description }) => (
              <article
                className="masarak-feature-card"
                key={number}
                data-reveal
              >
                <div className="masarak-feature-card-top">
                  <span>{number}</span>
                  <div className="masarak-feature-icon">
                    <Icon size={23} strokeWidth={1.7} />
                  </div>
                </div>

                <h3>{title}</h3>
                <p>{description}</p>
                <div className="masarak-feature-line" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section className="masarak-section masarak-dashboard-section">
        <div className="masarak-container masarak-dashboard-grid">
          <div className="masarak-dashboard-copy" data-reveal>
            <SectionLabel number="05">لوحة التحكم</SectionLabel>

            <h2>
              كل إنجاز ليك...
              <br />
              <span>في مكان واحد.</span>
            </h2>

            <p>
              تابع رحلتك التعليمية من لوحة تحكم
              واحدة. اعرف إيه اللي أنجزته، وإيه
              اللي محتاج تشتغل عليه، وخلي تقدمك
              واضح قدامك.
            </p>

            <ul className="masarak-dashboard-benefits">
              <li>
                <CheckCircle2 size={18} /> متابعة تقدمك
                التعليمي
              </li>
              <li>
                <CheckCircle2 size={18} /> معرفة المرحلة
                الحالية
              </li>
              <li>
                <CheckCircle2 size={18} /> الوصول للخطوة
                القادمة
              </li>
            </ul>

            <Link href="/dashboard" className="masarak-btn-primary">
              استكشف لوحة التحكم
              <ArrowLeft size={17} />
            </Link>
          </div>

          <div className="masarak-dashboard-preview" data-reveal>
            <div className="masarak-dashboard-topbar">
              <span>لوحة تحكم الطالب</span>
              <span className="masarak-online-indicator">
                <i /> معاينة توضيحية
              </span>
            </div>

            <div className="masarak-dashboard-welcome">
              <div>
                <span>أهلاً بيك في مسارك</span>
                <h3>رحلتك مستمرة!</h3>
              </div>
              <div className="masarak-dashboard-avatar">
                <GraduationCap size={22} />
              </div>
            </div>

            <div className="masarak-dashboard-metrics">
              <div>
                <span>التقدم الكلي</span>
                <strong>25%</strong>
              </div>
              <div>
                <span>المراحل المكتملة</span>
                <strong>01</strong>
              </div>
              <div>
                <span>المستوى الحالي</span>
                <strong>02</strong>
              </div>
            </div>

            <div className="masarak-dashboard-current">
              <div className="masarak-dashboard-current-heading">
                <span>المرحلة الحالية</span>
                <span>02 / 04</span>
              </div>
              <h4>أساسيات تطوير الويب</h4>
              <p>
                واصل التعلم، أنت على الطريق الصحيح.
              </p>
              <div className="masarak-dashboard-progress">
                <span style={{ width: "45%" }} />
              </div>
              <div className="masarak-dashboard-current-footer">
                <span>45% من المرحلة</span>
                <span>استمر في التقدم</span>
              </div>
            </div>

            <div className="masarak-dashboard-next">
              <span>
                <Zap size={16} /> خطوتك القادمة
              </span>
              <strong>ابدأ تعلم JavaScript</strong>
              <ChevronLeft size={18} />
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="masarak-final-section">
        <div className="masarak-container masarak-final-content" data-reveal>
          <div className="masarak-final-mark">
            <Image
              src="/masarak-symbol-transparent.png"
              alt="رمز مسارك"
              width={52}
              height={52}
              priority
              className="masarak-final-logo"
            />
          </div>

          <SectionLabel>ابدأ رحلتك</SectionLabel>

          <h2>
            رحلتك المهنية مش محتاجة تخمين...
            <br />
            محتاجة <span>مسار.</span>
          </h2>

          <p>
            ابدأ بخطوة واضحة، وخلي كل خطوة بعدها
            تقربك من هدفك.
          </p>

          <Link href={primaryHref} className="masarak-final-button">
            {primaryLabel}
            <ArrowLeft size={18} />
          </Link>

          <span className="masarak-final-caption">
            YOUR JOURNEY. YOUR DIRECTION. YOUR FUTURE.
          </span>
        </div>
      </section>
    </div>
  );
}
