/**
 * Browser-only personal state. Reading status never writes back to JSON data.
 */
const storagePrefix = "financial-os:read-list";

export function readStateKey(date: string) {
  return `${storagePrefix}:${date}`;
}

export function loadReadArticleIds(date: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(readStateKey(date));
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReadArticleIds(date: string, articleIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(readStateKey(date), JSON.stringify(articleIds));
}
