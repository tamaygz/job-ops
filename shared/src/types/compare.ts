/**
 * Types for the Profile Compare feature.
 *
 * A normalised, sanitised profile derived from scraping a third-party LinkedIn URL.
 * Intentionally omits contact information (email, phone) for privacy.
 */

export interface NormalisedCompareProfile {
  sourceUrl: string;
  fetchedAt: string;
  basics: {
    name: string;
    headline: string;
    location: string;
    summary: string;
  };
  sections: {
    experience: CompareExperienceItem[];
    education: CompareEducationItem[];
    skills: CompareSkillItem[];
    certifications: CompareCertificationItem[];
    projects: CompareProjectItem[];
    languages: CompareLanguageItem[];
    awards: CompareAwardItem[];
  };
}

export interface CompareExperienceItem {
  company: string;
  position: string;
  period: string;
  description: string;
}

export interface CompareEducationItem {
  school: string;
  degree: string;
  area: string;
  period: string;
}

export interface CompareSkillItem {
  name: string;
  keywords: string[];
}

export interface CompareCertificationItem {
  title: string;
  issuer: string;
  date: string;
}

export interface CompareProjectItem {
  name: string;
  period: string;
  description: string;
}

export interface CompareLanguageItem {
  language: string;
  fluency: string;
}

export interface CompareAwardItem {
  title: string;
  awarder: string;
  date: string;
}

/** Keys that can be compared between profiles */
export type CompareSectionKey =
  | "basics"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "languages"
  | "awards";

export type SectionVerdict = "stronger" | "weaker" | "comparable";

/** LLM evaluation result for one section */
export interface SectionEvaluation {
  section: CompareSectionKey;
  verdict: SectionVerdict;
  rationale: string;
}

/** Full comparison result */
export interface CompareResult {
  ownProfile: import("./settings").ResumeProfile;
  otherProfile: NormalisedCompareProfile;
  evaluations: SectionEvaluation[];
  jobId?: string;
  jobTitle?: string;
  overallOwnScore?: number;
  overallOtherScore?: number;
}
