import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { pbiDetailRoute } from "../../../src/application/backlog";
import { newNoteText, splitNoteText } from "../../../src/domain/notes";
import { exportPath, sentinel } from "../backlog-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminFolder, adminProject, customerFolder, customerProject } from "../knowledge-vault";
import { pbiChildren, pbiId, pbiTitle, seedPbiVault } from "../pbi-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const dialog = () => browser.$(`${ROOT} [role="dialog"][data-state="open"]`);

async function press(element: WebdriverIO.Element) {
  await expect(element).toBeDisplayed();
  await browser.execute((button: HTMLElement) => button.focus(), element);
  await browser.keys("Enter");
}

before(async () => {
  await seedPbiVault();
  await openView();
});

async function openPbi() {
  await setViewRoute(pbiDetailRoute(customerProject, pbiId));
  await expect(el("pbi-detail").$("h1")).toHaveText(pbiTitle);
}

async function vaultText(path: string) {
  const text = await readVaultText(path);
  if (text === null) throw new Error("Missing fixture note " + path);
  return text;
}

async function replaceInVault(path: string, previous: string, next: string) {
  await browser.executeObsidian(
    async ({ app }, source, from, to) => {
      const note = app.vault.getFileByPath(source);
      if (!note) throw new Error("Missing fixture note");
      await app.vault.process(note, (text) => {
        if (!text.includes(from)) throw new Error("Missing fixture text");
        return text.replace(from, to);
      });
    },
    path,
    previous,
    next,
  );
}

function normalizeLines(value: string) {
  return value.replace(/\r\n/g, "\n");
}

it("loads the latest external body after a conflict and saves a new canonical draft", async () => {
  await openPbi();
  await press(await el("pbi-tab-edit"));
  const form = el("pbi-edit-form");
  const editor = form.$("textarea[name=markdown]");
  const original = splitNoteText(await vaultText(exportPath));
  const draft = original.body.replace("## Historie", "## Entwurf");
  await editor.setValue(draft);
  await replaceInVault(exportPath, "## Historie", "## Externe Änderung");
  const outside = splitNoteText(await vaultText(exportPath));
  expect(outside.frontmatter).toEqual(original.frontmatter);
  await press(await el("pbi-save"));
  const notice = form.$("[role=alert]");
  await expect(notice).toHaveText(expect.stringContaining("im Tresor geändert"));
  expect(normalizeLines(await editor.getValue())).toBe(normalizeLines(draft));
  expect(await vaultText(exportPath)).toBe(outside.text);
  await press(await form.$("button=Aktuell gespeicherten Stand laden"));
  const expected = normalizeLines(outside.body);
  await browser
    .waitUntil(async () => normalizeLines(await editor.getValue()) === expected)
    .catch(() => false);
  expect(normalizeLines(await editor.getValue())).toBe(expected);
  await expect(notice).not.toExist();
  const merged = outside.body.replace("## Externe Änderung", "## Bewusste Zusammenführung");
  await editor.setValue(merged);
  const submitted = await editor.getValue();
  await press(await el("pbi-save"));
  await browser.waitUntil(
    async () => splitNoteText(await vaultText(exportPath)).body === submitted,
  );
  const latest = await vaultText(exportPath);
  expect(latest).toContain(sentinel);
  expect(latest).toContain("pbl-id: 008");
  expect(latest).toContain("pbi_requirement_id: REQ-03");
  await press(await el("pbi-tab-usecase"));
  await expect(el("knowledge-body")).toHaveText(
    expect.stringContaining("Bewusste Zusammenführung"),
  );
});

it("updates compact PBI entity scope immediately on direct assignment and removal", async () => {
  const entityId = "knowledge-33333333-3333-4333-8333-000000000061";
  const title = "Prüfentität";
  const path = customerFolder + "/" + title + ".md";
  await browser.executeObsidian(
    async ({ app }, target, text) => {
      await app.vault.create(target, text);
    },
    path,
    newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        id: entityId,
        project_id: customerProject,
        display_id: "ENT-06",
        kind: "entity",
        approval: "approved",
        title,
      },
      "## Bedeutung\n\nZuordnung prüfen.",
    ),
  );
  await replaceInVault(
    adminFolder + "/Admin service.md",
    "---\n",
    [
      "---",
      "schema: product-engineering.backlog/v1",
      "id: backlog-33333333-3333-4333-8333-000000000062",
      "",
    ].join("\n"),
  );
  await openPbi();
  await press(await el("pbi-tab-links"));
  const scope = el("domain-scope");
  const selector = `[data-domain-scope-link="${entityId}"]`;
  const link = scope.$(selector);
  await scope.$("select[name=domain-assignment]").selectByAttribute("value", entityId);
  await press(await scope.$("button[type=submit]"));
  await expect(link).toBeDisplayed();
  expect(await vaultText(path)).toContain("id: UC-09");
  const context = el("pbi-context");
  const visible = () => context.getText().then((text) => text.includes(title));
  const attachedInPlace = await browser.waitUntil(visible).catch(() => false);
  await setViewRoute(pbiDetailRoute(adminProject, pbiId));
  await expect(el("pbi-detail").$("h1")).toHaveText("Admin service");
  await expect(context).toHaveText(expect.stringContaining("Keine passenden Entitäten"));
  await openPbi();
  await press(await el("pbi-tab-links"));
  await expect(context).toHaveText(expect.stringContaining(title));
  await press(await scope.$(`li:has(${selector}) [data-domain-remove-assignment]`));
  await expect(link).not.toExist();
  expect(await vaultText(path)).not.toContain("id: UC-09");
  const removedInPlace = await browser.waitUntil(async () => !(await visible())).catch(() => false);
  await expect(context).toHaveText(expect.stringContaining("Organisation"));
  expect({ attachedInPlace, removedInPlace }).toEqual({
    attachedInPlace: true,
    removedInPlace: true,
  });
});

it("rereads the linked PRD approval when preparation is explicitly refreshed", async () => {
  await openPbi();
  const next = el("pbi-next");
  const refresh = el("pbi-readiness-refresh");
  await expect(next).toHaveText("Akzeptanzkriterium ergänzen");
  const prd = customerFolder + "/PRD-03.md";
  await replaceInVault(prd, "approval: approved", "approval: draft");
  expect(await vaultText(prd)).toContain("approval: draft");
  await expect(refresh).toBeEnabled();
  await press(await refresh);
  await expect(next).toHaveText("Verknüpftes PRD freigeben · PRD-03");
  await press(await next);
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("PRD-03"));
  await press(await el("project-record-return"));
  await expect(next).toBeFocused();
  await replaceInVault(prd, "approval: draft", "approval: approved");
});

it("identifies the PBI and describes four keyboard-accessible companion choices at phone width", async () => {
  await openPbi();
  await narrowKnowledgeLeaf();
  await browser.execute(
    (element: HTMLElement) => {
      const leaf = element.closest<HTMLElement>(".workspace-leaf");
      if (!leaf) throw new Error("Missing native PBI leaf");
      leaf.style.flex = "0 0 320px";
      leaf.style.width = "320px";
    },
    await el("pbi-detail"),
  );
  await press(await el("pbi-tab-companions"));
  const trigger = el("pbi-add-companion");
  await press(await trigger);
  await expect(dialog()).toBeDisplayed();
  const context = await dialog().getText();
  const fits = await browser.execute(
    (element: HTMLElement) => element.scrollWidth <= element.clientWidth + 1,
    await dialog(),
  );
  const options = [
    ["TASK", "Task erfassen", /Arbeitsschritt/i],
    ["ISS", "Issue erfassen", /Hindernis/i],
    ["Q", "Frage erfassen", /Antwort/i],
    ["BUG", "Bug erfassen", /erwarteten Verhalten/i],
  ] as const;
  const observed = [];
  for (const [kind, , purpose] of options) {
    if (kind !== "TASK") await browser.keys("Tab");
    const choice = el("pbi-companion-" + kind);
    await expect(choice).toBeFocused();
    const semantics = await browser.execute(
      (element: HTMLElement) => {
        const id = element.getAttribute("aria-describedby") ?? "";
        return {
          id,
          description: element.ownerDocument.getElementById(id)?.textContent ?? "",
          glyph: element.querySelector("svg")?.innerHTML,
          height: element.getBoundingClientRect().height,
        };
      },
      await choice,
    );
    observed.push({
      ...semantics,
      name: await choice.getComputedLabel(),
      explainsPurpose: purpose.test(semantics.description),
    });
  }
  await browser.keys("Enter");
  const form = el("backlog-form");
  await expect(form.$("input[name=title]")).toBeFocused();
  await expect(form.$("select[name=state]")).toHaveValue("Open");
  await expect(form.$("select[name=priority]")).toHaveValue("P2");
  await expect(form.$("select[name=owner]")).toHaveValue("");
  const heading = await dialog().$("h2").getText();
  await browser.keys("Escape");
  await expect(trigger).toBeFocused();
  expect(await pbiChildren()).toEqual([]);
  expect({
    displaysPbi: context.includes(pbiId) && context.includes(pbiTitle),
    fits,
    names: observed.map(({ name }) => name),
    purposes: observed.map(({ explainsPurpose }) => explainsPurpose),
    descriptions: new Set(observed.map(({ id }) => id).filter(Boolean)).size,
    glyphs: new Set(observed.map(({ glyph }) => glyph).filter(Boolean)).size,
    tappable: observed.map(({ height }) => height >= 44),
    heading,
  }).toEqual({
    displaysPbi: true,
    fits: true,
    names: options.map(([, name]) => name),
    purposes: [true, true, true, true],
    descriptions: 4,
    glyphs: 4,
    tappable: [true, true, true, true],
    heading: `Bug erfassen · ${pbiId}`,
  });
});
