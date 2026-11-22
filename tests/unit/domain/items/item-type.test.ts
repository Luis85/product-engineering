import { expect, it } from "vitest";
import { ITEM_STATUSES, itemType } from "../../../../src/domain/items";

const path = "Records/Items/Hallway.md";
const id = "item-3f2b8c1e-7a44-4d0b-9c2e-5b1f0a6d9e21";
const stored = {
  schema: "product-engineering.item/v1",
  id,
  title: "Hallway light",
  status: "open",
  due: "2026-12-01",
  extra: "preserve",
};

it("declares ordered stable property and value codes and decodes a version one item", () => {
  expect(ITEM_STATUSES).toEqual(["open", "done"]);
  expect(itemType.folder).toBe("Items");
  expect(itemType.keys).toEqual(["title", "status", "due"]);
  expect(itemType.decode({ path, frontmatter: stored })).toEqual({
    path,
    frontmatter: stored,
    kind: "editable",
    id,
    version: 1,
    values: { title: "Hallway light", status: "open", due: "2026-12-01" },
    issues: [],
  });
});

it("keeps a note with broken fields editable and reports each issue with its key", () => {
  expect(
    itemType.decode({
      path,
      frontmatter: { ...stored, title: "multiple\nlines", status: "closed", due: "2026-02-29" },
    }),
  ).toMatchObject({
    kind: "editable",
    values: {},
    issues: [
      { key: "title", code: "title.invalid" },
      { key: "status", code: "status.unknown" },
      { key: "due", code: "field.date" },
    ],
  });
  expect(
    itemType.decode({ path, frontmatter: { ...stored, title: null, due: null } }),
  ).toMatchObject({
    kind: "editable",
    values: { status: "open" },
    issues: [{ key: "title", code: "field.missing" }],
  });
  expect(
    itemType.decode({ path, frontmatter: { ...stored, title: 42, status: null } }),
  ).toMatchObject({
    kind: "editable",
    issues: [
      { key: "title", code: "field.text" },
      { key: "status", code: "field.missing" },
    ],
  });
});

it("keeps a newer item read-only without projecting unknown values", () => {
  const frontmatter = { ...stored, schema: "product-engineering.item/v2" };
  expect(itemType.decode({ path, frontmatter })).toEqual({
    path,
    frontmatter,
    id,
    version: 2,
    kind: "read-only",
    values: {},
    issue: { code: "schema.newer", version: 2 },
  });
});
