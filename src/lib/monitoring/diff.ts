import * as Diff from "diff";

export function generateTextDiff(oldText: string, newText: string): string {
  const diff = Diff.diffWords(oldText, newText);
  return diff
    .map((part) => {
      if (part.added) return `<ins class="diff-add">${escapeHtml(part.value)}</ins>`;
      if (part.removed) return `<del class="diff-remove">${escapeHtml(part.value)}</del>`;
      return escapeHtml(part.value);
    })
    .join("");
}

export function generateLineDiff(oldText: string, newText: string): string {
  const diff = Diff.diffLines(oldText, newText);
  const lines: string[] = [];

  for (const part of diff) {
    const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
    const className = part.added
      ? "diff-line-add"
      : part.removed
        ? "diff-line-remove"
        : "diff-line-same";

    const partLines = part.value.split("\n").filter((l, i, arr) => {
      if (i === arr.length - 1 && l === "") return false;
      return true;
    });

    for (const line of partLines) {
      lines.push(`<div class="${className}">${prefix}${escapeHtml(line)}</div>`);
    }
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getDiffStats(oldText: string, newText: string) {
  const diff = Diff.diffWords(oldText, newText);
  let additions = 0;
  let deletions = 0;

  for (const part of diff) {
    if (part.added) additions += part.value.length;
    if (part.removed) deletions += part.value.length;
  }

  return { additions, deletions };
}
