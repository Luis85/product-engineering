export function releaseAll(releases: Iterable<() => void>): void {
  const failures: unknown[] = [];
  for (const release of [...releases].toReversed()) {
    try {
      release();
    } catch (cause) {
      failures.push(cause);
    }
  }
  if (failures.length > 0) throw failures[0];
}
