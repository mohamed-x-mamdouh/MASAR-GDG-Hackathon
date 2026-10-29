
"use client";

import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { useLearningProgress } from "@/components/learning-progress-provider";

type ModuleContentGateProps = {
  moduleId: string;
  children: ReactNode;
  showLockedMessage?: boolean;
};

export default function ModuleContentGate({
  moduleId,
  children,
  showLockedMessage = true,
}: ModuleContentGateProps) {
  const { getStatus } = useLearningProgress();
  const isLocked = getStatus(moduleId) === "locked";

  if (!isLocked) {
    return <>{children}</>;
  }

  if (!showLockedMessage) {
    return null;
  }

  return (
    <section className="panel detail-section">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <LockKeyhole size={24} />
        <div>
          <h2>Learning content locked</h2>
          <p>
            Pass the quizzes for this module&apos;s prerequisites to unlock
            its learning resources, completion criteria, practical task, and
            knowledge checkpoint.
          </p>
          <p className="stat-note">
            You can preview the learning objectives and prerequisites while
            this module is locked.
          </p>
        </div>
      </div>
    </section>
  );
}
