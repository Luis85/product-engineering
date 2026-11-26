import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { parse } from "yaml";
import { nfrCatalogRoute, pbiDetailRoute } from "../../../src/application/backlog";
import { newNoteText, splitNoteText } from "../../../src/domain/notes";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { adminProject, customerFolder, customerProject } from "../knowledge-vault";
import { adminMapId, customerMapId, matchedMapPath, seedStoryMapsVault } from "../story-maps-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  ROOT,
  setTheme,
  setViewRoute,
  VIEW_TYPE,
  writeVaultText,
} from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const context = (part: string) => el(`story-map-context-${part}`);
const field = (name: string) => browser.$(`${ROOT} [role=dialog] [name="${name}"]`);
const frontmatter = async (path: string): Promise<unknown> =>
  parse(splitNoteText((await readVaultText(path)) ?? "").frontmatter?.yaml ?? "");

before(async () => {
  await seedStoryMapsVault();
  await openView();
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await expect(el("story-map-detail")).toExist();
});

it("places stories in their step and release band, including the unsliced band", async () => {
  await expect(el("story-map-activity-ACT-01")).toHaveText(
    expect.stringContaining("Offene Fälle filtern"),
  );
  await expect(el("story-map-cell-SL-01-STEP-02")).toHaveText(
    expect.stringContaining("Nur offene Servicefälle anzeigen"),
  );
  await expect(el("story-map-cell-SL-02-STEP-03")).toHaveText(
    expect.stringContaining("Leere Trefferliste verstehen"),
  );
  await expect(el("story-map-cell-unsliced-STEP-04")).toHaveText(
    expect.stringContaining("Übergabeliste mit dem Team teilen"),
  );
});

it("starts all four contexts closed and keeps only the active context open", async () => {
  const parts = ["foundations", "prototypes", "nfrs", "entities"];
  for (const part of parts) await expect(context(part)).toHaveAttribute("aria-expanded", "false");
  await context("foundations").click();
  await expect(context("foundations")).toHaveAttribute("aria-expanded", "true");
  await context("entities").click();
  await expect(context("foundations")).toHaveAttribute("aria-expanded", "false");
  await expect(context("entities")).toHaveAttribute("aria-expanded", "true");
  await context("entities").click();
  await expect(context("entities")).toHaveAttribute("aria-expanded", "false");
});

it("preserves an unsaved PRD selection when the nested Vault picker closes", async () => {
  const original = await readVaultText(matchedMapPath);
  await context("foundations").click();
  await expect(el("story-map-foundation-edit")).toBeDisplayed();
  await el("story-map-foundation-edit").click();
  const prd = browser.$(`${ROOT} [role=dialog] [name=prdId]`);
  await prd.selectByAttribute("value", "");
  await el("knowledge-add-reference").click();
  await expect(el("knowledge-vault-picker")).toBeDisplayed();
  await browser.keys("Escape");
  await expect(prd).toHaveValue("");
  await expect(el("knowledge-add-reference")).toBeFocused();
  await el("story-map-foundation-cancel").click();
  await expect(el("story-map-foundation-edit")).toBeFocused();
  expect(await readVaultText(matchedMapPath)).toBe(original);
});

it("follows the selected Job and exposes the map from the same Job record", async () => {
  const foundations = context("foundations");
  if ((await foundations.getAttribute("aria-expanded")) !== "true") await foundations.click();
  await el("story-map-source-job").click();
  await expect(el("knowledge-story-map-backlink")).toBeDisplayed();
  await el("project-record-return").click();
  await expect(el("story-map-source-job")).toBeFocused();
});

it("authors an activity, step, slice and story with stable placement and cancellable keyboard edits", async () => {
  await expect(el("story-map-add-activity")).toBeDisplayed();
  await el("story-map-add-activity").click();
  await expect(field("title")).toBeFocused();
  await field("title").setValue("Nachtschicht übergeben");
  await el("story-map-journey-save").click();
  const activity = browser.$(ROOT).$("h3=Nachtschicht übergeben");
  await expect(activity).toBeDisplayed();
  const added = activity.parentElement().parentElement();
  await added.$('[data-testid="story-map-add-step"]').click();
  await field("title").setValue("Schicht beobachten");
  await el("story-map-journey-save").click();
  await el("story-map-add-slice").click();
  await field("title").setValue("Übergabe erproben");
  await field("detail").setValue("Rückfragen sofort klären.");
  await el("story-map-journey-save").click();
  const cell = browser.$(
    `${ROOT} button[aria-label='Story für „Schicht beobachten“ in „Übergabe erproben“ hinzufügen']`,
  );
  await expect(cell).toExist();
  await cell.click();
  await field("title").setValue("Nachtschicht einweisen");
  await field("detail").setValue("Die nächste Schicht kennt den Bearbeitungsstand.");
  await el("story-map-journey-save").click();
  const card = browser.$(
    `${ROOT} button[aria-label='Details und Aktionen für Story „Nachtschicht einweisen“']`,
  );
  await expect(card).toBeFocused();
  await browser.keys("Enter");
  const edit = el("story-map-card-edit");
  await edit.click();
  await field("title").setValue("Ein vermiedener Entwurf");
  await browser.keys("Escape");
  await expect(card).toBeFocused();
  expect(await readVaultText(matchedMapPath)).not.toContain("Ein vermiedener Entwurf");
});

it("opens the canonical PBI and restores the exact Story link using keyboard Back", async () => {
  const card = el("story-map-card-CARD-02");
  const link = card.$('[data-story-item="UC-14"]');
  await expect(link).toBeDisplayed();
  await browser.execute((button: HTMLElement) => button.focus(), await link);
  await browser.keys("Enter");
  await expect(el("pbi-detail")).toExist();
  expect(await readViewRoute()).toEqual(pbiDetailRoute(customerProject, "UC-14"));
  const frameBack = browser.$(`${ROOT} [data-testid="frame-history"] button[aria-label="Zurück"]`);
  await browser.execute((button: HTMLElement) => button.focus(), await frameBack);
  await browser.keys("Enter");
  await expect(card.$('[data-story-item="UC-14"]')).toBeFocused();
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId));
});

it("creates story-owned work, then assigns the same identity to the linked PBI on explicit save", async () => {
  await el("story-map-card-CARD-02").$('[data-testid="story-map-work"]').click();
  await expect(el("story-map-work-add")).toBeDisplayed();
  await el("story-map-work-add").click();
  await expect(field("destination")).toHaveValue("UC-14");
  await field("destination").selectByAttribute("value", "story");
  await field("kind").selectByAttribute("value", "Q");
  await field("title").setValue("Welche Fälle gehören in die Nachtschicht?");
  await el("story-map-work-save").click();
  const work = el("story-map-owned-work").$("button=Welche Fälle gehören in die Nachtschicht?");
  await expect(work).toBeDisplayed();
  const mapBefore = await readVaultText(matchedMapPath);
  const id = mapBefore?.match(/id: (Q-[a-f0-9-]+)/)?.[1];
  if (!id) throw new Error("The story-owned work was not saved");
  await work.click();
  await field("destination").selectByAttribute("value", "UC-14");
  await el("story-map-work-save").click();
  await expect(el("story-map-work-attached")).toHaveText(expect.stringContaining(id));
  const mapAfter = await readVaultText(matchedMapPath);
  expect(mapAfter).toContain(`recordId: ${id}`);
  expect(mapAfter).not.toContain(`id: ${id}`);
  await browser.keys("Escape");
  await expect(el("story-map-card-CARD-02").$('[data-testid="story-map-work"]')).toBeFocused();
});

it("assigns map NFRs and entities canonically and exposes the map from both records", async () => {
  const nfrId = "nfr-33333333-3333-4333-8333-000000000741";
  const entityId = "knowledge-33333333-3333-4333-8333-000000000742";
  const nfrPath = customerFolder + "/NFRs/Test NFR.md";
  const entityPath = customerFolder + "/Falluebergabe.md";
  await writeVaultText(
    nfrPath,
    newNoteText(
      {
        schema: "product-engineering.nfr/v1",
        project_id: customerProject,
        id: nfrId,
        title: "Übergabe protokollieren",
        requirement: "Übergaben sind nachvollziehbar.",
        acceptance: "Die Liste enthält einen Zeitstempel.",
      },
      "",
    ),
  );
  await writeVaultText(
    entityPath,
    newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        project_id: customerProject,
        id: entityId,
        kind: "entity",
        title: "Fallübergabe",
        display_id: "ENT-49",
        approval: "draft",
      },
      "Eine Übergabe zwischen Schichten.",
    ),
  );

  await context("nfrs").click();
  await expect(el("nfr-assign")).toBeDisplayed();
  await el("nfr-assign").click();
  await browser.$(`${ROOT} [data-testid="nfr-assignment-picker"] [value="${nfrId}"]`).click();
  await el("nfr-assign-save").click();
  await expect(context("nfrs")).toHaveText(expect.stringContaining("1"));
  await browser.$(`${ROOT} [data-nfr-open-record="${nfrId}"]`).click();
  expect(await readViewRoute()).toEqual(nfrCatalogRoute(customerProject, nfrId));
  await browser.$(`${ROOT} [data-nfr-open-target="map:${customerMapId}"]`).click();
  await expect(el("story-map-detail")).toExist();
  expect(await frontmatter(nfrPath)).toMatchObject({
    targets: [{ kind: "map", id: customerMapId }],
  });
  await browser.$(`${ROOT} [data-nfr-open-record="${nfrId}"]`).click();
  await el("nfr-target-choices").click();
  const mapTarget = browser.$(
    `${ROOT} [data-testid="nfr-editor"] input[value="map:${customerMapId}"]`,
  );
  await mapTarget.click();
  await el("nfr-editor-save").click();
  await expect(context("nfrs")).toHaveText(expect.stringContaining("0"));
  expect(await frontmatter(nfrPath)).toMatchObject({ targets: [] });
  await setViewRoute(nfrCatalogRoute(customerProject, nfrId));
  await el("nfr-target-choices").click();
  await mapTarget.click();
  await el("nfr-editor-save").click();
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await expect(context("nfrs")).toHaveText(expect.stringContaining("1"));

  await context("entities").click();
  const assignment = browser.$(
    `${ROOT} [data-testid="domain-scope"] select[name=domain-assignment]`,
  );
  await assignment.selectByAttribute("value", entityId);
  await browser.$(`${ROOT} [data-testid="domain-scope"] button[type=submit]`).click();
  await expect(context("entities")).toHaveText(expect.stringContaining("1"));
  await browser.$(`${ROOT} [data-domain-scope-link="${entityId}"]`).click();
  const mapLink = browser.$(`${ROOT} [data-domain-scope-link="${customerMapId}"]`);
  await expect(mapLink).toBeDisplayed();
  await browser
    .$(`${ROOT} [data-testid="domain-scope"] button[data-domain-remove-assignment]`)
    .click();
  await expect(mapLink).not.toExist();
  await assignment.selectByAttribute("value", customerMapId);
  await browser.$(`${ROOT} [data-testid="domain-scope"] button[type=submit]`).click();
  await browser.$(`${ROOT} [data-domain-scope-link="${customerMapId}"]`).click();
  await expect(el("story-map-detail")).toExist();
  expect(await frontmatter(entityPath)).toMatchObject({
    domain_scope: [{ kind: "map", id: customerMapId }],
  });
});

it("reloads a long outside-edited card and preserves unrelated Vault bytes during a journey edit", async () => {
  const original = await readVaultText(matchedMapPath);
  if (!original) throw new Error("Missing fixture Story Map");
  const long = "DieFalluebergabeFuerZusammenarbeitUeberOrganisationsgrenzen"
    .repeat(3)
    .slice(0, 155);
  const edited = original
    .replace("Übergabeliste mit dem Team teilen", long)
    .replace(/^(schema: .+)$/m, '$1\npartner_note: "Outside # contribution" # unchanged');
  const markdown = "\n# Workshop\n\n[[Documentation|External author]]\n";
  await writeVaultText(matchedMapPath, edited + markdown);
  await expect(el("story-map-card-CARD-05")).toHaveText(expect.stringContaining(long));
  await browser.waitUntil(
    async () => (await readVaultText(".obsidian/workspace.json"))?.includes(customerMapId) ?? false,
  );
  await browser.reloadObsidian();
  await expect(el("story-map-card-CARD-05")).toHaveText(expect.stringContaining(long));
  await el("story-map-edit-slice-SL-02").click();
  await field("detail").setValue("Leere Übergaben bewusst vermeiden.");
  await el("story-map-journey-save").click();
  await expect(el("story-map-slice-header-SL-02")).toHaveText(
    expect.stringContaining("Leere Übergaben bewusst vermeiden."),
  );
  const persisted = await readVaultText(matchedMapPath);
  expect(persisted).toContain('partner_note: "Outside # contribution" # unchanged');
  expect(persisted?.endsWith(markdown)).toBe(true);
});

it("keeps full-width slice actions and all four context controls in 1252 and 320 pixel split leaves", async () => {
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 760,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.executeObsidian(
    async ({ app }, type, adminRoute) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      if (!leaf) throw new Error("Missing customer leaf");
      const sibling = app.workspace.getLeaf("split", "vertical");
      await sibling.setViewState({ type, state: { route: adminRoute } });
      await app.workspace.revealLeaf(leaf);
      leaf.view.containerEl.closest(".workspace-leaf")?.setAttribute("data-v13-leaf", "customer");
      sibling.view.containerEl.closest(".workspace-leaf")?.setAttribute("data-v13-leaf", "admin");
    },
    VIEW_TYPE,
    storyMapsRoute(adminProject, adminMapId),
  );
  const leaf = browser.$("[data-v13-leaf=customer]");
  const edit = leaf.$('[data-testid="story-map-edit-slice-SL-01"]');
  const panes = [
    { width: 1252, height: 760, theme: "light" },
    { width: 320, height: 510, theme: "dark" },
  ] as const;
  for (const { width, height, theme } of panes) {
    await setTheme(theme);
    await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
      width: 1600,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.execute(
      (pane: HTMLElement, pixels: number) => {
        pane.style.flex = `0 0 ${pixels}px`;
        pane.style.width = `${pixels}px`;
      },
      await leaf,
      width,
    );
    const measure = async () =>
      browser.execute(
        (pane: HTMLElement) => {
          const bounds = pane.getBoundingClientRect();
          const header = pane
            .querySelector('[data-testid="story-map-slice-header-SL-01"]')
            ?.getBoundingClientRect();
          const cell = pane
            .querySelector('[data-testid="story-map-cell-SL-01-STEP-02"]')
            ?.getBoundingClientRect();
          const controls = Array.from(
            pane.querySelectorAll("button[aria-controls][data-testid^=story-map-context-]"),
          );
          const scroll = pane.querySelector('[data-testid="story-map-scroll"]');
          return {
            width: Math.round(bounds.width),
            reachable: controls.filter((button) => {
              const box = button.getBoundingClientRect();
              return box.width > 0 && box.left >= bounds.left && box.right <= bounds.right;
            }).length,
            local: Boolean(scroll && scroll.getBoundingClientRect().right <= bounds.right),
            x: cell?.left,
            y: cell?.top,
            full: Boolean(header && scroll && header.width >= scroll.clientWidth - 25),
          };
        },
        await leaf,
      );
    await edit.scrollIntoView();
    const initialLayout = await measure();
    expect(initialLayout).toMatchObject({ width, reachable: 4, local: true, full: true });
    await edit.click();
    await expect(leaf.$('[data-testid="story-map-journey-save"]')).toBeDisplayed();
    expect(await measure()).toEqual(initialLayout);
    await browser.keys("Escape");
    await expect(edit).toBeFocused();
  }
  await expect(browser.$('[data-v13-leaf=admin] [data-testid="story-map-detail"]')).toHaveAttribute(
    "data-story-map-id",
    adminMapId,
  );
});
