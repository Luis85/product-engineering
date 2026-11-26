# Item record v1

Product Engineering recognizes item notes anywhere in the vault by the schema marker. It creates them in the configured root folder's `Items` subfolder. The default path is `Product Engineering/Items`. The subfolder name is the same in English and German.

```yaml
---
schema: product-engineering.item/v1
id: item-3f2b8c1e-7a44-4d0b-9c2e-5b1f0a6d9e21
title: Replace the hallway light
status: open
due: !!str 2026-12-01
---
```

| Property | Kind | Rule |
| --- | --- | --- |
| `schema` | Text | `product-engineering.item/v1` for this version. |
| `id` | Text | `item-` followed by a lowercase UUID. The ID stays fixed when the title, filename, or folder changes. |
| `title` | Required text | A single line of up to 100 characters without control characters. New and changed titles must be unique after Unicode NFC normalization and case folding, and their sanitized filenames must fit 255 UTF-8 bytes with extension and clash suffix. |
| `status` | Required text | `open` or `done`. |
| `due` | Optional date | A real calendar date in `YYYY-MM-DD` form. Omit the property to leave it unset. |

The plugin derives a filename from the title. If that filename is occupied it tries suffixes from ` (2)` to ` (100)`. A title change updates a filename that still follows the old title. A filename chosen by hand is kept.

| Issue | Plugin behavior |
| --- | --- |
| `field.missing`, `field.text`, `title.invalid`, `status.unknown`, `field.date` | The form shows the affected field and lets the user repair it. |
| `title.too-long`, `title.taken` | The form blocks a new or changed title until the filename fits and there is no item with that title. |
| `title.duplicate` | The list marks matching titles. A user can edit other fields while leaving the loaded title unchanged. |
| `id.missing`, `id.malformed`, `id.other-type`, `id.duplicate` | The item is read-only. A duplicate ID also shows another affected note's path. |
| `schema.newer`, `migration.failed` | The item is read-only. |
| `schema.malformed`, `schema.unknown-type`, `frontmatter.unreadable` | The note is shown in Data issues. Unreadable frontmatter is listed under the configured root folder. |

Saving an item changes the relevant frontmatter lines and keeps unknown keys, comments on untouched lines, and the Markdown body. If a field changed both in the form and in the vault, the form shows the competing values for review before saving. A read-only item or a Data issues entry can be opened in Obsidian for inspection.
