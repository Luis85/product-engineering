import { expect, it } from "vitest";
import { recordId, recordIdIssue } from "../../../../src/domain/notes";

const uuid = "c0336ac6-5dbe-4fef-bcf5-23f3785ddef3";

it("writes a stable type-prefixed id with a lowercase UUID", () => {
  expect(recordId("release-note", uuid.toUpperCase())).toBe("release-note-" + uuid);
});

it.each([uuid, "019aeee6-54ba-7679-ae53-f720f2550a2f", "00000000-0000-0000-0000-000000000000"])(
  "accepts a lowercase UUID without requiring one version %s",
  (id) => expect(recordIdIssue("release-note", recordId("release-note", id))).toBeUndefined(),
);

it.each([undefined, null])("reports %s as missing", (value) => {
  expect(recordIdIssue("release-note", value)).toBe("id.missing");
});

it.each([
  "",
  "release-note",
  uuid,
  4,
  {},
  "release_note-" + uuid,
  "Release-note-" + uuid,
  "release-note-" + uuid.toUpperCase(),
  "release-note-" + uuid + "\n",
  "release-note-" + uuid.slice(1),
])("reports a malformed id %j", (value) => {
  expect(recordIdIssue("release-note", value)).toBe("id.malformed");
});

it("reports a well-formed id from another note type", () => {
  expect(recordIdIssue("release", recordId("release-note", uuid))).toBe("id.other-type");
});
