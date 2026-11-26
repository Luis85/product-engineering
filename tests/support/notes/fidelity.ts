const frontmatter = {
  schema: "product-engineering.item/v1",
  id: "fidelity-store",
  title: "01067",
  status: "open",
  due: "2026-11-22",
};

const recordText =
  '---\nschema: product-engineering.item/v1\nid: fidelity-store\ntitle: "01067"\nstatus: open\ndue: !!str 2026-11-22\n---\nBody\n';

const closingPrefixes = ["---", "--- \t", "----", "-----", "---- ", "--- x", "---x", "--- # c"];
const nonClosers = [" ---", "..."];

export const FENCE_CASES = [
  ...["\n", "\r\n"].flatMap((eol) => [
    ...closingPrefixes.map((closing) => ({ closing, eol, bom: false, found: true })),
    ...nonClosers.map((closing) => ({ closing, eol, bom: false, found: false })),
  ]),
  { closing: "---", eol: "\r\n", bom: true, found: true },
  { closing: "---", eol: "\r", bom: false, found: true },
];

export const LINE_EDIT_CASES = [
  { name: "four dashes", closing: "----", eol: "\n", bom: false },
  { name: "three dashes with blanks", closing: "--- \t", eol: "\r\n", bom: true },
];

export function fenceText(
  { closing, eol, bom }: { closing: string; eol: string; bom: boolean },
  status = "open",
): string {
  return (
    (bom ? "\uFEFF" : "") + ["---", "status: " + status + "  # keep", closing, "Body", ""].join(eol)
  );
}

export function yamlSampleValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(yamlSampleValue);
  if (typeof value === "number") return { number: Object.is(value, -0) ? "-0" : String(value) };
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  return { unexpectedType: typeof value };
}

export const VAULT_FACTS = {
  paths: ["a/b", "/", "a/.././b", " a  /é "],
  yaml: {
    tagged: { due: "2026-11-22", leading: "01067", enabled: true },
    taggedDateType: "string",
    roundTrip: { title: "Notes", enabled: true, tags: ["alpha", "beta"] },
    rejectsBadYaml: true,
  },
  writes: {
    missingFolderRejected: true,
    newCacheIsNull: true,
    read: "---\ntitle: Native\n---\nBody\n",
    duplicateRejected: true,
    edit: {
      before: "Native",
      afterProcess: "Native",
      processResult: "---\ntitle: Edited\n---\nBody\n",
      finalTitle: "From native frontmatter",
    },
    renameKeptFile: true,
    oldPathIsGone: true,
    trashReturnedTrue: true,
    trashRemovedFile: true,
    events: [
      "create:Fidelity native",
      "create:Fidelity native/Nested",
      "create:Fidelity native/Nested/Example.md",
      "modify:Fidelity native/Nested/Example.md",
      "modify:Fidelity native/Nested/Example.md",
      "rename:Fidelity native/Nested/Example.md>Fidelity native/Nested/Renamed.md",
      "delete:Fidelity native/Nested/Renamed.md",
    ],
  },
  brokenYaml: {
    hasFrontmatter: false,
    hasFrontmatterPosition: false,
    yamlLines: [0, 2],
  },
  fences: FENCE_CASES.map(({ found }) => ({ indexed: found, split: found })),
};

export const STORE_FACTS = {
  foldersExist: true,
  createdPaths: [
    "Fidelity records/Nested/Alpha.md",
    "Fidelity records/Nested/alpha (2).md",
    "Fidelity records/Nested/Alpha (3).md",
  ],
  createdFrontmatter: frontmatter,
  raw: recordText,
  readFrontmatter: frontmatter,
  updatedFrontmatter: { ...frontmatter, status: "done" },
  updatedRaw: recordText.replace("status: open", "status: done"),
  renamedPath: "Fidelity records/Nested/alpha.md",
  taken: { success: false, error: "NotePathTakenError" },
  records: [
    "Fidelity outside.md",
    "Fidelity records/Nested/Alpha (3).md",
    "Fidelity records/Nested/alpha (2).md",
    "Fidelity records/Nested/alpha.md",
  ],
  broken: ["Fidelity records/Nested/Broken.md"],
  removed: true,
  missing: { success: false, error: "NoteNotFoundError" },
};

export const WRITE_FACTS = {
  edited: LINE_EDIT_CASES.map((fixture) => ({
    indexed: true,
    saved: { status: "done" },
    text: fenceText(fixture, "done"),
  })),
  refused: { success: false, error: "NoteWriteRefusedError", reason: "layout" },
  keptText: fenceText({ closing: "---x", eol: "\n", bom: false }),
};

export const READINESS_FACTS = {
  create: ["changed", "resolve", "resolved"],
  edit: ["changed", "resolve", "resolved"],
  trash: ["deleted", "resolved"],
};
