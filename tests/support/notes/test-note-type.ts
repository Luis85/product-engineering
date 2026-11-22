import {
  checkbox,
  date,
  defineNoteType,
  list,
  number,
  recordId,
  required,
  text,
} from "../../../src/domain/notes";
import type { Frontmatter } from "../../../src/domain/notes";

export const TEST_UUID = "00000000-0000-0000-0000-000000000001";
export const TEST_RECORD_ID = recordId("test-record", TEST_UUID);

function renameLegacyField(raw: Frontmatter, from: string, to: string): Frontmatter {
  const properties = { ...raw };
  const existing = properties[to];
  if ((existing === undefined || existing === null) && Object.hasOwn(properties, from)) {
    properties[to] = properties[from];
  }
  delete properties[from];
  return properties;
}

export const testNoteType = defineNoteType({
  type: "test-record",
  version: 3,
  folder: "Tests/Records",
  fields: {
    title: required(text()),
    points: number(),
    done: checkbox(),
    due: date(),
    tags: list(),
  },
  migrations: {
    1: (raw) => renameLegacyField(raw, "name", "title"),
    2: (raw) => renameLegacyField(raw, "score", "points"),
  },
});
