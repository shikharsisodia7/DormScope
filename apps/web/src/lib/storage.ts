const FAVORITES_KEY = "dormscope_favorites";
const COMPARE_KEY = "dormscope_compare";

export function getGuestFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function setGuestFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export function toggleGuestFavorite(id: string): string[] {
  const current = getGuestFavorites();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  setGuestFavorites(next);
  return next;
}

export function getCompareIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function setCompareIds(ids: string[]) {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, 4)));
}

export function exportComparisonCsv(dorms: Record<string, unknown>[]) {
  if (!dorms.length) return;
  const keys = Object.keys(dorms[0]);
  const header = keys.join(",");
  const rows = dorms.map((d) => keys.map((k) => JSON.stringify(d[k] ?? "")).join(","));
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dormscope-comparison.csv";
  a.click();
}
