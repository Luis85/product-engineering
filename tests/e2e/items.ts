import { browser } from "@wdio/globals";
import { catalogFor } from "../../src/application/messages";
import { newNoteText, schemaMarker } from "../../src/domain/notes";
import type { Frontmatter } from "../../src/domain/notes";
import { DEFAULT_SETTINGS } from "../../src/domain/shell";
import { openViewSettings, readVaultText, ROOT, TEST_LANGUAGE } from "./support";

export const texts = catalogFor(TEST_LANGUAGE);
export const ITEMS_FOLDER = DEFAULT_SETTINGS.rootFolder + "/Items";

export function itemPath(name: string): string {
  return ITEMS_FOLDER + "/" + name + ".md";
}

export function fixtureId(sequence: number): string {
  return "item-4287ee12-a3af-4726-b048-" + sequence.toString(16).padStart(12, "0");
}

export function fixtureItem(
  id: string,
  title: string,
  options: {
    readonly version?: number;
    readonly status?: string;
    readonly due?: string;
    readonly fields?: Frontmatter;
    readonly body?: string;
  } = {},
): string {
  return newNoteText(
    {
      schema: schemaMarker("item", options.version ?? 1),
      id,
      title,
      status: options.status ?? "open",
      ...(options.due === undefined ? {} : { due: options.due }),
      ...options.fields,
    },
    options.body ?? "",
  );
}

export async function writeNote(path: string, text: string): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, notePath, contents) => {
      const existing = app.vault.getFileByPath(notePath);
      if (existing) {
        await app.vault.process(existing, () => contents);
        return;
      }
      const folder = notePath.slice(0, Math.max(0, notePath.lastIndexOf("/")));
      if (folder && !app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
      await app.vault.create(notePath, contents);
    },
    path,
    text,
  );
}

export async function openItems(): Promise<void> {
  await openViewSettings();
  await browser
    .$(`${ROOT} [data-testid='items-screen'][data-index-ready='true']`)
    .waitForDisplayed({
      timeoutMsg: "The Items index did not become ready",
    });
}

export function itemCard(key: string) {
  return browser.$(`${ROOT} [data-testid='item-list'] [data-card-key=${JSON.stringify(key)}]`);
}

export function itemForm() {
  return browser.$(`${ROOT} [data-testid='item-form']`);
}

export async function openCreate(): Promise<void> {
  await browser.$(`${ROOT} [data-focus='add']`).click();
  await itemForm().waitForDisplayed();
}

export async function openEdit(key: string): Promise<void> {
  await itemCard(key).$("[data-focus='edit']").click();
  await itemForm().waitForDisplayed();
}

export async function fillTitle(title: string): Promise<void> {
  await itemForm().$("[name='title']").setValue(title);
}

export async function selectStatus(status: "open" | "done"): Promise<void> {
  await itemForm().$("[name='status']").selectByAttribute("value", status);
}

export async function save(): Promise<void> {
  await itemForm().$("[type='submit']").click();
}

export async function waitForNote(
  path: string,
  accepts?: (contents: string) => boolean,
): Promise<string> {
  let text: string | null = null;
  await browser.waitUntil(
    async () => {
      text = await readVaultText(path);
      return text !== null && (accepts?.(text) ?? true);
    },
    { timeoutMsg: "The expected note text was not written" },
  );
  if (text === null) throw new Error("The note is missing");
  return text;
}

export function noteId(text: string): string {
  const id = /^id: (item-[0-9a-f-]+)$/m.exec(text)?.[1];
  if (!id) throw new Error("The saved note has no item ID");
  return id;
}

export async function waitForNotice(message: string): Promise<void> {
  await browser.waitUntil(
    () =>
      browser.execute(
        (expected) =>
          Array.from(document.querySelectorAll(".notice")).some(
            (notice) => notice.textContent?.trim() === expected,
          ),
        message,
      ),
    { timeoutMsg: "The write confirmation was not displayed" },
  );
}
