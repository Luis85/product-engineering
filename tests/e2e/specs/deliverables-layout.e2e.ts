import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import {
  backlogBoardRoute,
  backlogRoute,
  deliverablesRoute,
  nfrCatalogRoute,
} from "../../../src/application/backlog";
import {
  adrIdentity,
  adrPath,
  noteTitle,
  plannedTitle,
  reviewTitle,
  seedDeliverablesReference,
} from "../deliverables-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminProject, customerFolder, customerProject } from "../knowledge-vault";
import { openView, readVaultText, reloadPlugin, ROOT, setTheme, setViewRoute } from "../support";

const el = (test: string) => browser.$(`${ROOT} [data-testid="${test}"]`);
const first = () => el("deliverables").$("[data-deliverable-id]:nth-child(1)");
const second = () => el("deliverables").$("[data-deliverable-id]:nth-child(2)");
const dialog = () => browser.$(`${ROOT} [role="dialog"][data-state="open"]`);
const route = deliverablesRoute(customerProject);
const registers = '[data-testid="deliverables"]';
const dimensions = (width: number, height: number) =>
  browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

before(() => seedDeliverablesReference());

function geometry(dialogOpen: boolean) {
  return browser.execute(
    (scope, active) => {
      const root = document.querySelector(scope);
      const leaf = root?.closest(".workspace-leaf");
      const target = root?.querySelector(
        active ? '[role="dialog"][data-state="open"]' : ".pe-backlog-tabs",
      );
      if (!leaf || !target) throw new Error("Missing native leaf or target");
      const box = leaf.getBoundingClientRect();
      const panel = target.getBoundingClientRect();
      const buttons = [...target.querySelectorAll("button")];
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        inside:
          panel.left >= box.left - 1 &&
          panel.right <= box.right + 1 &&
          panel.top >= box.top - 1 &&
          panel.bottom <= box.bottom + 1,
        overflow: target.scrollWidth - target.clientWidth,
        buttons: buttons.map((button) => {
          const range = button.ownerDocument.createRange();
          range.selectNodeContents(button);
          const hit = button.getBoundingClientRect();
          const text = range.getBoundingClientRect();
          return {
            label: button.textContent?.trim(),
            fits:
              hit.left <= text.left + 1 &&
              hit.right >= text.right - 1 &&
              hit.top <= text.top + 1 &&
              hit.bottom >= text.bottom - 1,
          };
        }),
      };
    },
    ROOT,
    dialogOpen,
  );
}

function captureMeasurements() {
  return browser.execute(
    (scope, selector) => {
      function needed<E extends HTMLElement>(parent: ParentNode, query: string): E {
        const element = parent.querySelector<E>(query);
        if (!element) throw new Error("Missing register element " + query);
        return element;
      }

      function textRects(element: HTMLElement) {
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        return [...range.getClientRects()].filter(({ width }) => width > 0);
      }

      function within(outer: DOMRect, inner: DOMRect) {
        return (
          outer.left <= inner.left + 1 &&
          outer.right >= inner.right - 1 &&
          outer.top <= inner.top + 1 &&
          outer.bottom >= inner.bottom - 1
        );
      }

      function overlaps(left: DOMRect, right: DOMRect) {
        return (
          Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 &&
          Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1
        );
      }

      function selectedWidth(status: HTMLSelectElement) {
        const selected = status.selectedOptions.item(0);
        if (!selected) throw new Error("Missing selected status");
        const probe = status.cloneNode(false) as HTMLSelectElement;
        probe.removeAttribute("data-testid");
        probe.setAttribute("aria-hidden", "true");
        probe.tabIndex = -1;
        Object.assign(probe.style, {
          position: "absolute",
          insetInlineStart: "0",
          width: "max-content",
          minWidth: "0",
          maxWidth: "none",
          visibility: "hidden",
          pointerEvents: "none",
        });
        probe.append(selected.cloneNode(true));
        status.after(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return { label: selected.label.trim(), required: width };
      }

      function summarize(row: HTMLElement) {
        const summary = needed(row, ".pe-deliverable-summary");
        const progress = needed(row, ".pe-deliverable-progress");
        const title = needed(row, '[data-testid="deliverable-row-title"]');
        const titleLabel = title.querySelector<HTMLElement>('[data-slot="label"]') ?? title;
        const status = needed<HTMLSelectElement>(row, '[data-testid="deliverable-row-status"]');
        const owner = needed(row, '[data-testid="deliverable-row-owner"]');
        const titleText = textRects(titleLabel);
        const titleBox = title.getBoundingClientRect();
        const summaryBox = summary.getBoundingClientRect();
        const ownerText = textRects(owner);
        const progressBox = progress.getBoundingClientRect();
        const statusBox = status.getBoundingClientRect();
        const measure = selectedWidth(status);
        return {
          title: title.textContent?.trim(),
          titleLines: new Set(titleText.map((rect) => Math.round(rect.top))).size,
          titleWithinSummary: within(summaryBox, titleBox),
          titleFits: titleText.every((rect) => within(titleBox, rect)),
          titleOverlapsStatus: titleText.some((rect) => overlaps(rect, statusBox)),
          titleOverlapsOwner: titleText.some((rect) =>
            ownerText.some((line) => overlaps(rect, line)),
          ),
          owner: owner.textContent?.trim(),
          ownerFits: ownerText.every((rect) => within(progressBox, rect)),
          ownerOverlapsStatus: ownerText.some((rect) => overlaps(rect, statusBox)),
          status: measure.label,
          statusWidth: statusBox.width,
          requiredStatusWidth: measure.required,
          statusFits: statusBox.width + 1 >= measure.required && within(progressBox, statusBox),
        };
      }

      const surface = needed(document, scope + " " + selector);
      const leaf = surface.closest<HTMLElement>(".workspace-leaf");
      if (!leaf) throw new Error("Missing native leaf");
      const { x, y, width, height } = leaf.getBoundingClientRect();
      return {
        leaf: { x, y, width, height },
        overflow: surface.scrollWidth - surface.clientWidth,
        rows: [...surface.querySelectorAll<HTMLElement>(".pe-deliverable-row")].map(summarize),
      };
    },
    ROOT,
    registers,
  );
}

function rowHitTargets() {
  return browser.execute(
    (scope, selector) => {
      const row = scope + " " + selector + " .pe-deliverable-row";
      return [...document.querySelectorAll<HTMLElement>(row + " button, " + row + " select")].map(
        (control) => {
          control.scrollIntoView({ block: "nearest", inline: "nearest" });
          const { x, y, width, height } = control.getBoundingClientRect();
          const hit = control.ownerDocument.elementFromPoint(x + width / 2, y + height / 2);
          return { label: control.getAttribute("data-testid"), hit: control.contains(hit) };
        },
      );
    },
    ROOT,
    registers,
  );
}

async function setLeafDimensions(width: number) {
  const viewport = width === 390 ? 1740 : width + 44;
  await dimensions(viewport, 940);
  const sample = await captureMeasurements();
  await dimensions(viewport, 940 + 900 - sample.leaf.height);
  await browser.waitUntil(
    async () => {
      const { leaf } = await captureMeasurements();
      return leaf.width === width && leaf.height === 900;
    },
    { timeoutMsg: `Missing ${width} × 900 Obsidian leaf` },
  );
}

async function expectReadableRegister(width: number) {
  const data = await captureMeasurements();
  const hitTargets = await rowHitTargets();
  process.stdout.write("V11 register " + JSON.stringify({ ...data, hitTargets }) + "\n");
  expect(data.leaf).toMatchObject({ width, height: 900 });
  expect(data.overflow).toBe(0);
  const fit = {
    titleWithinSummary: true,
    titleFits: true,
    titleOverlapsStatus: false,
    titleOverlapsOwner: false,
    owner: "Nicht zugewiesen",
    ownerFits: true,
    ownerOverlapsStatus: false,
    statusFits: true,
  };
  expect(data.rows).toEqual([
    expect.objectContaining({ ...fit, title: plannedTitle, status: "Geplant" }),
    expect.objectContaining({ ...fit, title: reviewTitle, status: "In Prüfung" }),
  ]);
  expect(hitTargets).toHaveLength(8);
  expect(hitTargets.every(({ hit }) => hit)).toBe(true);
  return data.rows.map(({ titleLines }) => titleLines);
}

async function press(element: WebdriverIO.Element, key = "Enter") {
  await browser.execute((node: HTMLElement) => node.focus(), element);
  await browser.keys(key);
}

it("keeps matched normal and short 390px views, tabs, keyboard status and dialog cancellation usable", async () => {
  await openView();
  await setTheme("light");
  await setViewRoute(route);
  await expect(first().$('[data-testid="deliverable-row-title"]')).toHaveText(plannedTitle);
  await expect(second().$('[data-testid="deliverable-row-title"]')).toHaveText(reviewTitle);
  await expect(second().$('[data-testid="deliverable-open-note"]')).toHaveText(noteTitle);
  await setLeafDimensions(1440);
  const normal = await geometry(false);
  expect(normal.inside).toBe(true);
  expect(await expectReadableRegister(1440)).toEqual([1, 1]);
  await narrowKnowledgeLeaf();
  await setLeafDimensions(390);
  const narrowLines = await expectReadableRegister(390);
  expect(narrowLines[1]).toBeGreaterThan(1);
  await dimensions(1600, 485);
  await setTheme("dark");
  const tabs = ["Board", "Liste", "NFRs", "Deliverables"];
  for (const entry of [
    backlogBoardRoute(customerProject, true),
    backlogRoute(customerProject),
    nfrCatalogRoute(customerProject),
    route,
  ]) {
    await setViewRoute(entry);
    await expect(el("backlog-tab-deliverables")).toBeDisplayed();
    const narrow = await geometry(false);
    expect(narrow).toMatchObject({ width: 390, inside: true, overflow: 0 });
    expect(narrow.buttons).toEqual(tabs.map((label) => ({ label, fits: true })));
  }
  const status = first().$('[data-testid="deliverable-row-status"]');
  await press(await status, "ArrowDown");
  await expect(status).toHaveValue("in-progress");
  await expect(status).toBeFocused();
  const create = el("deliverable-create");
  await press(await create);
  await expect(el("deliverable-title")).toBeFocused();
  const short = await geometry(true);
  expect(short).toMatchObject({ width: 390, inside: true, overflow: 0 });
  expect(short.buttons.every(({ fits }) => fits)).toBe(true);
  await el("deliverable-title").setValue("Ungespeicherter Entwurf");
  await browser.keys("Escape");
  await expect(dialog()).not.toExist();
  await expect(create).toBeFocused();
  const prepare = first().$('[data-testid="deliverable-create-note"]');
  await press(await prepare);
  await expect(dialog().$('[name="kind"]')).toHaveValue("test-concept");
  const prepared = await geometry(true);
  expect(prepared).toMatchObject({ width: 390, inside: true, overflow: 0 });
  expect(prepared.buttons.every(({ fits }) => fits)).toBe(true);
  await browser.keys("Escape");
  await expect(dialog()).not.toExist();
  await expect(prepare).toBeFocused();
  expect(
    await browser.executeObsidian(
      ({ app }) =>
        app.vault.getMarkdownFiles().filter((file) => file.path.includes("/Deliverables/")).length,
    ),
  ).toBe(2);
  process.stdout.write("V11 native layout " + JSON.stringify({ normal, short, prepared }) + "\n");
});

it("finds the indexed proof after a physical rename and reload, then clears a missing link in scope", async () => {
  await setTheme("light");
  await setViewRoute(route);
  const original = await readVaultText(adrPath);
  const newTitle = "Außerhalb umbenannte Entscheidung";
  const renamed = customerFolder + "/Außerhalb verschoben.md";
  await browser.executeObsidian(
    async ({ app }, from, to, label) => {
      const note = app.vault.getFileByPath(from);
      if (!note) throw new Error("Missing fixture Knowledge note");
      await app.fileManager.renameFile(note, to);
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        fields.title = label;
        fields.keep_unknown = "outside";
      });
    },
    adrPath,
    renamed,
    newTitle,
  );
  await expect(second().$('[data-testid="deliverable-open-note"]')).toHaveText(newTitle);
  await reloadPlugin();
  await openView();
  await setViewRoute(route);
  await expect(second().$('[data-testid="deliverable-open-note"]')).toHaveText(newTitle);
  await second().$('[data-testid="deliverable-open-note"]').click();
  await el("knowledge-edit").click();
  const markdown = browser.$(`${ROOT} textarea[name="markdown"]`);
  const draft = "## Entwurf\n\nDiese Änderung bleibt im Editor.";
  await markdown.setValue(draft);
  await el("knowledge-references-tab").click();
  await el("knowledge-deliverable-backlink").click();
  await el("knowledge-keep-editing").click();
  await el("knowledge-editing-tab").click();
  await expect(markdown).toHaveValue(draft);
  await el("knowledge-references-tab").click();
  await el("knowledge-deliverable-backlink").click();
  await el("knowledge-discard-leave").click();
  await expect(el("deliverable-title")).toHaveValue(reviewTitle);
  await browser.keys("Escape");
  await expect(el("deliverable-editor")).not.toExist();
  const search = el("deliverable-search");
  await search.setValue("außerhalb umbenannte");
  await expect(el("deliverable-row-title")).toHaveText(reviewTitle);
  await el("deliverable-filter-status").selectByAttribute("value", "planned");
  await expect(el("deliverable-filtered-empty")).toHaveText(
    "Keine Deliverables für diese Auswahl.",
  );
  await el("deliverable-reset").click();
  await expect(search).toBeFocused();
  await el("deliverable-filter-template").selectByAttribute("value", "adr");
  await expect(el("deliverable-row-title")).toHaveText(reviewTitle);
  await el("deliverable-reset").click();
  const beforeDelete = await readVaultText(renamed);
  expect(beforeDelete).toContain("id: " + adrIdentity);
  expect(beforeDelete).toContain("keep_unknown: outside");
  expect(beforeDelete).not.toBe(original);
  await browser.executeObsidian(async ({ app }, path) => {
    const note = app.vault.getFileByPath(path);
    if (!note) throw new Error("Missing renamed fixture note");
    await app.vault.delete(note);
  }, renamed);
  await expect(el("deliverable-missing-note")).toHaveText(expect.stringContaining(adrIdentity));
  await second().$('[data-testid="deliverable-link-note"]').click();
  await expect(el("deliverable-knowledge")).toHaveValue(adrIdentity);
  await el("deliverable-knowledge").selectByAttribute("value", "");
  await el("deliverable-save").click();
  await expect(el("deliverable-missing-note")).not.toExist();
  await setViewRoute(deliverablesRoute(adminProject));
  await expect(el("deliverable-empty")).toBeDisplayed();
  await setViewRoute(route);
  await expect(second().$('[data-testid="deliverable-row-title"]')).toHaveText(reviewTitle);
});
