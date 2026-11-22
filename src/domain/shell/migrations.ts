type RawRecord = Readonly<Record<string, unknown>>;

export type MigrationSteps = Readonly<Record<number, (raw: RawRecord) => unknown>>;

type MigrationResult =
  { readonly ok: true; readonly raw: RawRecord } | { readonly ok: false; readonly version: number };

export function isPlainRecord(value: unknown): value is RawRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function runMigrations(
  raw: RawRecord,
  start: number,
  target: number,
  migrations: MigrationSteps,
  advance: (result: RawRecord, version: number) => RawRecord,
): MigrationResult {
  let value = raw;
  for (let version = start; version < target; version += 1) {
    try {
      const next = migrations[version]?.({ ...value });
      if (!isPlainRecord(next)) return { ok: false, version };
      value = advance(next, version + 1);
    } catch {
      return { ok: false, version };
    }
  }
  return { ok: true, raw: value };
}
