import { TITLE_MAX_LENGTH } from "../../../domain/items";
import { MAX_FILE_NAME_BYTES } from "../../../domain/notes";
import type { ItemsCatalog } from "./catalog";

export const en = {
  settings: {
    label: "Items",
    empty: "No items yet.",
    loading: "Loading items…",
    folder: (path) => `Items are stored in ${path}.`,
  },
  fields: { title: "Title", status: "Status", due: "Due date" },
  missing: { title: "Enter a title.", status: "Choose a status." },
  issues: {
    "title.invalid": () =>
      `Enter one line of up to ${TITLE_MAX_LENGTH} characters without control characters.`,
    "title.too-long": () =>
      `Shorten the title so the file name fits within ${MAX_FILE_NAME_BYTES} bytes.`,
    "title.taken": () => "Choose a title that no other item uses.",
    "title.duplicate": () => "Another item has this title.",
    "status.unknown": () => "Choose Open or Done.",
  },
  status: { open: "Open", done: "Done" },
  form: {
    createTitle: "Add item",
    editTitle: "Edit item",
    summary: {
      title: "Check the item details",
      detail: "Correct the highlighted fields and save again.",
    },
  },
  actions: { add: "Add item", edit: "Edit", remove: "Delete", cancel: "Cancel", save: "Save" },
} satisfies ItemsCatalog;
