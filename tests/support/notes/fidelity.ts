const frontmatter = {
  schema: "product-engineering.item/v1",
  id: "fidelity-store",
  title: "01067",
  status: "open",
  due: "2026-11-22",
};

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
};

export const STORE_FACTS = {
  foldersExist: true,
  createdPaths: [
    "Fidelity records/Nested/Alpha.md",
    "Fidelity records/Nested/alpha (2).md",
    "Fidelity records/Nested/Alpha (3).md",
  ],
  createdFrontmatter: frontmatter,
  raw: '---\nschema: product-engineering.item/v1\nid: fidelity-store\ntitle: "01067"\nstatus: open\ndue: !!str 2026-11-22\n---\nBody\n',
  readFrontmatter: frontmatter,
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

export const READINESS_FACTS = {
  create: ["changed", "resolve", "resolved"],
  edit: ["changed", "resolve", "resolved"],
  trash: ["deleted", "resolved"],
};
