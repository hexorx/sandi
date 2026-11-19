import { createHash } from "node:crypto";
import type { JevRequest } from "./types.js";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashRequest(request: JevRequest): string {
  return `sha256:${createHash("sha256").update(canonicalJson(request), "utf8").digest("hex")}`;
}
