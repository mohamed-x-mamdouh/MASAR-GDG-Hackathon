export type StudentRoadmapModule = {
  id: string;
  moduleKey: string;
  sortOrder: number;
  title: string;
  description: string;
  estimatedDuration: string;
  skills: string[];
  objectives: string[];
  completionCriteria: string[];
  status: "completed" | "current" | "locked";
  prerequisites: string[];
  totalLessons: number;
  completedLessons: number;
};

export type StudentLessonResource = {
  id: string;
  resourceKey: string;
  title: string;
  resourceType: string;
  url: string;
  provider: string;
  description: string | null;
  language: string;
  durationMinutes: number | null;
  isRequired: boolean;
};

export type StudentLesson = {
  id: string;
  lessonKey: string;
  title: string;
  description: string | null;
  objectives: string[];
  sortOrder: number;
  isRequired: boolean;
  isCompleted: boolean;
  resources: StudentLessonResource[];
};

export type StudentTopic = {
  id: string;
  topicKey: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  objectives: string[];
  estimatedDuration: string | null;
  lessons: StudentLesson[];
};

export type StudentModuleResource = {
  id: string;
  resourceKey: string;
  title: string;
  resourceType: string;
  url: string;
  provider: string;
  description: string | null;
  language: string;
  durationMinutes: number | null;
  isRequired: boolean;
};

export type StudentModuleDetail = {
  id: string;
  moduleKey: string;
  sortOrder: number;
  title: string;
  description: string;
  estimatedDuration: string;
  skills: string[];
  objectives: string[];
  completionCriteria: string[];
  status: "completed" | "current" | "locked";
  isAllowed: boolean;
  prerequisites: {
    id: string;
    moduleKey: string;
    title: string;
    sortOrder: number;
  }[];
  previousModule: { id: string; moduleKey: string; title: string } | null;
  nextModule: { id: string; moduleKey: string; title: string } | null;
  moduleResources: StudentModuleResource[];
  topics: StudentTopic[];
  totalLessons: number;
  completedLessons: number;
};

export type RoadmapOverviewData = {
  hasPublishedRoadmap: boolean;
  trackTitle: string;
  trackDescription: string;
  versionNumber?: number;
  modules: StudentRoadmapModule[];
  completedCount: number;
  overallProgress: number;
  currentModuleId?: string;
};
