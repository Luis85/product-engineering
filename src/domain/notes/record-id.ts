export type IdIssue = "id.missing" | "id.malformed" | "id.other-type";

const format =
  /^([a-z]+(?:-[a-z]+)*)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function recordId(type: string, uuid: string): string {
  return type + "-" + uuid.toLowerCase();
}

export function recordIdIssue(type: string, value: unknown): IdIssue | undefined {
  if (value === undefined || value === null) return "id.missing";
  if (typeof value !== "string") return "id.malformed";
  const actualType = format.exec(value)?.[1];
  if (actualType === undefined) return "id.malformed";
  return actualType === type ? undefined : "id.other-type";
}
