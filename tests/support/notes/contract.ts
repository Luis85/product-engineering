import { describe } from "vitest";
import { contractClashes } from "./contract-clashes";
import { contractReads } from "./contract-reads";
import { contractWrites } from "./contract-writes";
import type { NoteStoreFixture } from "./fixture";

export function noteStoreContract(name: string, makeFixture: () => NoteStoreFixture): void {
  describe(`${name} contract`, () => {
    contractReads(makeFixture);
    contractWrites(makeFixture);
    contractClashes(makeFixture);
  });
}
