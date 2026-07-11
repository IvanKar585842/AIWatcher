import { Plan } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import { getUpgradeCopy, type PlanFeatureName } from "@/lib/plan-features";

export class UpgradeRequiredError extends ApiError {
  feature: PlanFeatureName;
  upgradeTitle: string;
  upgradeDescription: string;
  minPlan: Plan;

  constructor(feature: PlanFeatureName, status = 403) {
    const copy = getUpgradeCopy(feature);
    super(copy.description, status);
    this.name = "UpgradeRequiredError";
    this.feature = feature;
    this.upgradeTitle = copy.title;
    this.upgradeDescription = copy.description;
    this.minPlan = copy.minPlan;
  }
}

export function isUpgradeRequiredError(error: unknown): error is UpgradeRequiredError {
  return (
    error instanceof UpgradeRequiredError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "UpgradeRequiredError")
  );
}
