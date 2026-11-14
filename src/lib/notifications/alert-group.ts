/**
 * Agency alert grouping. Same client, same kind of change, short window.
 * A higher importance still goes out. History is not deleted.
 */

const RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function importanceRank(value: string | null | undefined): number {
  return RANK[value ?? ""] ?? 1;
}

export function normalizeAlertSummary(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function alertsLookRelated(
  left: { summary: string; category?: string | null },
  right: { summary: string; category?: string | null }
): boolean {
  if (left.category && right.category && left.category !== right.category) return false;
  const a = normalizeAlertSummary(left.summary);
  const b = normalizeAlertSummary(right.summary);
  if (!a || !b) return false;
  if (a === b) return true;
  const aStem = a.split(" ").slice(0, 4).join(" ");
  const bStem = b.split(" ").slice(0, 4).join(" ");
  return aStem.length >= 12 && aStem === bStem;
}

export function shouldFoldRepeat(input: {
  related: boolean;
  previousImportance: string | null | undefined;
  nextImportance: string | null | undefined;
}): boolean {
  if (!input.related) return false;
  return importanceRank(input.nextImportance) <= importanceRank(input.previousImportance);
}

type Groupable = {
  id: string;
  summary: string | null;
  importance: string | null;
  client: { id: string } | null;
  reason: string;
};

export function groupAgencyProblems<T extends Groupable>(rows: T[]): Array<T & { groupCount: number }> {
  const grouped: Array<T & { groupCount: number }> = [];
  for (const row of rows) {
    const match =
      row.client && row.summary && row.reason !== "check"
        ? grouped.find(
            (item) =>
              item.client?.id === row.client?.id &&
              item.summary != null &&
              alertsLookRelated({ summary: item.summary }, { summary: row.summary ?? "" })
          )
        : undefined;
    if (!match) {
      grouped.push({ ...row, groupCount: 1 });
      continue;
    }
    match.groupCount += 1;
    if (importanceRank(row.importance) > importanceRank(match.importance)) {
      const count = match.groupCount;
      Object.assign(match, row, { groupCount: count });
    }
  }
  return grouped;
}
