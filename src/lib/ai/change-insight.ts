import { ChangeCategory, ChangeImportance } from "@prisma/client";

/** Human-facing category labels AI may use (mapped onto Prisma enums). */
export const CHANGE_CATEGORY_LABELS = [
  "Pricing",
  "Product",
  "Documentation",
  "Blog",
  "Careers",
  "Security",
  "Legal",
  "Marketing",
  "Landing Page",
  "Navigation",
  "Images",
  "Design",
  "Footer",
  "Contact Information",
  "Terms of Service",
  "Privacy Policy",
  "Features",
  "Content",
  "Other",
] as const;

export type ChangeCategoryLabel = (typeof CHANGE_CATEGORY_LABELS)[number];

const LABEL_TO_PRISMA: Record<string, ChangeCategory> = {
  pricing: ChangeCategory.PRICE,
  price: ChangeCategory.PRICE,
  product: ChangeCategory.PRODUCT,
  documentation: ChangeCategory.DOCUMENTATION,
  docs: ChangeCategory.DOCUMENTATION,
  blog: ChangeCategory.CONTENT,
  careers: ChangeCategory.JOBS,
  jobs: ChangeCategory.JOBS,
  hiring: ChangeCategory.JOBS,
  security: ChangeCategory.POLICY,
  legal: ChangeCategory.POLICY,
  marketing: ChangeCategory.FEATURES,
  "landing page": ChangeCategory.CONTENT,
  landing: ChangeCategory.CONTENT,
  navigation: ChangeCategory.OTHER,
  nav: ChangeCategory.OTHER,
  images: ChangeCategory.OTHER,
  image: ChangeCategory.OTHER,
  design: ChangeCategory.OTHER,
  footer: ChangeCategory.OTHER,
  "contact information": ChangeCategory.CONTACT_INFO,
  contact: ChangeCategory.CONTACT_INFO,
  "terms of service": ChangeCategory.POLICY,
  terms: ChangeCategory.POLICY,
  "privacy policy": ChangeCategory.POLICY,
  privacy: ChangeCategory.POLICY,
  features: ChangeCategory.FEATURES,
  content: ChangeCategory.CONTENT,
  other: ChangeCategory.OTHER,
  policy: ChangeCategory.POLICY,
};

const PRISMA_TO_LABEL: Record<ChangeCategory, string> = {
  PRICE: "Pricing",
  CONTENT: "Content",
  JOBS: "Careers",
  POLICY: "Legal",
  CONTACT_INFO: "Contact Information",
  PRODUCT: "Product",
  DOCUMENTATION: "Documentation",
  FEATURES: "Features",
  OTHER: "Other",
};

export function mapCategoryLabelToPrisma(raw: string | null | undefined): ChangeCategory {
  if (!raw) return ChangeCategory.OTHER;
  const key = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (key in ChangeCategory) {
    return ChangeCategory[key as keyof typeof ChangeCategory];
  }
  // Direct prisma enum string
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (upper in ChangeCategory) {
    return ChangeCategory[upper as keyof typeof ChangeCategory];
  }
  return LABEL_TO_PRISMA[key] ?? ChangeCategory.OTHER;
}

export function defaultCategoryLabel(category: ChangeCategory | string): string {
  const key = String(category).toUpperCase() as ChangeCategory;
  return PRISMA_TO_LABEL[key] ?? String(category).replace(/_/g, " ");
}

export function formatImportanceEstimate(
  importance: ChangeImportance | string
): { tone: "minor" | "medium" | "high" | "critical"; label: string; emoji: string } {
  switch (String(importance).toUpperCase()) {
    case "LOW":
      return { tone: "minor", label: "Minor", emoji: "🟢" };
    case "MEDIUM":
      return { tone: "medium", label: "Medium", emoji: "🟡" };
    case "HIGH":
      return { tone: "high", label: "High", emoji: "🔴" };
    case "CRITICAL":
      return { tone: "critical", label: "Critical", emoji: "🔴" };
    default:
      return { tone: "medium", label: "Medium", emoji: "🟡" };
  }
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
