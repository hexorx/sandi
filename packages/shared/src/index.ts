/** Turn free text into a short, URL-safe slug. Handy for naming experiment runs. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Build a stable experiment id such as "2026-11-18-summarizer-v1". */
export function experimentId(name: string, date: Date = new Date()): string {
  return `${date.toISOString().slice(0, 10)}-${slugify(name)}`;
}
