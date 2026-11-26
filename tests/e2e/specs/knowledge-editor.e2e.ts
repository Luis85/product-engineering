import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { splitNoteText } from "../../../src/domain/notes";
import { jobPath, narrowKnowledgeLeaf, seedKnowledgeDetailVault } from "../knowledge-detail-vault";
import { customerProject, jobOne } from "../knowledge-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const bodySelector = `${ROOT} [data-testid=knowledge-body]`;
const editorSelector = `${ROOT} textarea[name=markdown]`;

before(seedKnowledgeDetailVault);

async function openJob() {
  await openView();
  await setViewRoute(knowledgeDetailRoute(customerProject, jobOne));
}

it("keeps Wissen current in the breadcrumb and rail on a typed note route", async () => {
  await openJob();
  await expect(browser.$(bodySelector).$("h2")).toHaveText("Übergabe");
  const section = await browser.$(`${ROOT} [data-testid=project-breadcrumb]`).getText();
  const current = await browser
    .$(`${ROOT} [data-testid=project-rail] [data-pe-focus-key=project-knowledge]`)
    .getAttribute("aria-current");
  expect({ section, current }).toEqual({ section: "Kundenportal / Wissen", current: "page" });
});

it("renders Obsidian Markdown headings with visible hierarchy and leaves the source intact", async () => {
  await openJob();
  await expect(browser.$(bodySelector).$("h2")).toHaveText("Übergabe");
  const source = await readVaultText(jobPath);
  const sizes = await browser.execute((selector) => {
    const body = document.querySelector(selector);
    const heading = body?.querySelector("h2");
    const paragraph = body?.querySelector("p");
    if (!heading || !paragraph)
      throw new Error("Missing heading or paragraph in rendered Markdown");
    const title = getComputedStyle(heading);
    const prose = getComputedStyle(paragraph);
    return {
      heading: Number.parseFloat(title.fontSize),
      paragraph: Number.parseFloat(prose.fontSize),
      headingWeight: Number(title.fontWeight),
      paragraphWeight: Number(prose.fontWeight),
    };
  }, bodySelector);
  expect(sizes.heading).toBeGreaterThan(sizes.paragraph);
  expect(sizes.headingWeight).toBeGreaterThan(sizes.paragraphWeight);
  expect(await readVaultText(jobPath)).toBe(source);
});

function setSelection(start: number, end: number) {
  return browser.execute(
    (selector, from, to) => {
      const control = document.querySelector<HTMLTextAreaElement>(selector);
      if (!control) throw new Error("Missing editor");
      control.setSelectionRange(from, to);
    },
    editorSelector,
    start,
    end,
  );
}

async function insideLeaf(selector: string) {
  return browser.execute(
    (root, controls) => {
      const leaf = document.querySelector(root)?.closest(".workspace-leaf");
      if (!leaf) throw new Error("Missing split leaf");
      const bounds = leaf.getBoundingClientRect();
      const elements = [...leaf.querySelectorAll(controls)];
      return {
        width: bounds.width,
        inside:
          elements.length > 0 &&
          elements.every((element) => {
            const area = element.getBoundingClientRect();
            return area.left >= bounds.left - 1 && area.right <= bounds.right + 1;
          }),
      };
    },
    ROOT,
    selector,
  );
}

it("formats and inserts ordinary links with keyboard recovery in a 390px leaf", async () => {
  await openJob();
  await narrowKnowledgeLeaf();
  const button = (name: string) => browser.$(`${ROOT} [data-testid="knowledge-${name}"]`);
  await button("edit").click();
  const editor = browser.$(editorSelector);
  await expect(editor).toBeFocused();
  const source = await readVaultText(jobPath);
  const draft = "Lead\n\nAlpha one\nBeta two\n\nTail stays";
  const block = browser.$(`${ROOT} select[name=block-format]`);
  const toolbar =
    "select[name=block-format], [data-testid=knowledge-insert-web-link], [data-testid=knowledge-insert-image], [data-testid=knowledge-preview]";
  expect(await insideLeaf(toolbar)).toEqual({ width: 390, inside: true });
  await editor.setValue(draft);
  await setSelection(draft.indexOf("Alpha") + 1, draft.indexOf("\n\nTail") + 1);
  await block.selectByAttribute("value", "numbered");
  const numbered = "Lead\n\n1. Alpha one\n2. Beta two\n\nTail stays";
  await expect(editor).toHaveValue(numbered);
  await expect(editor).toBeFocused();
  const start = numbered.indexOf("Beta two");
  await setSelection(start, start + 8);

  const dialog = "[role=dialog][data-state=open]";
  await button("insert-web-link").click();
  const url = browser.$(`${ROOT} ${dialog} input[name=url]`);
  await expect(url).toBeFocused();
  expect(await insideLeaf(dialog)).toEqual({ width: 390, inside: true });
  await url.setValue("mailto:test@example.invalid");
  await browser.keys("Enter");
  await expect(url).toHaveAttribute("aria-invalid", "true");
  await expect(url).toHaveValue("mailto:test@example.invalid");
  await expect(editor).toHaveValue(numbered);
  expect(await readVaultText(jobPath)).toBe(source);
  await browser.keys("Escape");
  await expect(editor).toBeFocused();
  const selection = await browser.execute((selector) => {
    const control = document.querySelector<HTMLTextAreaElement>(selector);
    return control && [control.selectionStart, control.selectionEnd];
  }, editorSelector);
  expect(selection).toEqual([start, start + 8]);

  await button("insert-web-link").click();
  await url.setValue("https://example.invalid/guide");
  await browser.keys("Enter");
  const linked = numbered.replace("Beta two", "[Beta two](https://example.invalid/guide)");
  await expect(editor).toHaveValue(linked);
  await expect(editor).toBeFocused();
  await button("save").click();
  await expect(button("save")).toBeDisabled();
  const saved = await readVaultText(jobPath);
  expect(splitNoteText(saved ?? "").body).toBe(linked.replaceAll("\n", "\r\n"));
  await button("content-tab").click();
  await expect(browser.$(bodySelector).$("ol li:nth-child(2) a")).toHaveAttribute(
    "href",
    "https://example.invalid/guide",
  );
});
