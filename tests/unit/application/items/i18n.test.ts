import { expect, it } from "vitest";
import { describeItemIssue, InvalidItemError } from "../../../../src/application/items";
import { catalogFor } from "../../../../src/application/messages";
import { LANGUAGES } from "../../../../src/application/shell";
import { describeError } from "../../../../src/application/user-messages";
import type { ItemIssue } from "../../../../src/domain/items";

const issues = [
  { key: "title", code: "field.missing" },
  { key: "status", code: "field.missing" },
  { key: "title", code: "field.text" },
  { key: "title", code: "title.invalid" },
  { key: "title", code: "title.too-long" },
  { key: "title", code: "title.taken" },
  { key: "title", code: "title.duplicate" },
  { key: "status", code: "status.unknown" },
  { key: "due", code: "field.date" },
  { code: "id.missing" },
  { code: "id.malformed" },
  { code: "id.other-type" },
  { code: "id.duplicate", other: "Other.md" },
  { code: "schema.newer", version: 2 },
  { code: "migration.failed", version: 1 },
] satisfies readonly ItemIssue[];

it.each(LANGUAGES)("words each item issue and validation error in %s", (language) => {
  const messages = catalogFor(language);
  const text = issues.map((issue) => describeItemIssue(issue, messages));
  expect(text.every((line) => line.trim().length > 0)).toBe(true);
  expect(new Set(text).size).toBe(text.length);
  expect(text[12]).toContain("Other.md");
  expect(messages.items.status.open).not.toBe(messages.items.status.done);
  expect(messages.items.settings.folder("Root/Items")).toContain("Root/Items");
  const error = new InvalidItemError({ issues: [{ key: "title", code: "title.invalid" }] });
  expect(describeError(error, messages)).toEqual({
    severity: "warning",
    ...messages.items.form.summary,
  });
});

it.each(LANGUAGES)("supplies visible labels for the Items view and form in %s", (language) => {
  const { settings, fields, status, form, actions } = catalogFor(language).items;
  const display = {
    "loading message": settings.loading,
    "title field": fields.title,
    "status field": fields.status,
    "due date field": fields.due,
    "open status": status.open,
    "done status": status.done,
    "create form heading": form.createTitle,
    "edit form heading": form.editTitle,
    "validation heading": form.summary.title,
    "validation detail": form.summary.detail,
    "add action": actions.add,
    "edit action": actions.edit,
    "delete action": actions.remove,
    "cancel action": actions.cancel,
    "save action": actions.save,
  };
  const missing = Object.entries(display)
    .filter(([, label]) => label.trim() === "")
    .map(([name]) => name);
  expect(missing).toEqual([]);
});
