export function normalizePath(path: string): string {
  const normalized = path
    .replace(/[\\/]+/g, "/")
    .replace(/^\/|\/$/g, "")
    .replaceAll("\u00a0", " ")
    .normalize("NFC");
  return normalized || "/";
}
