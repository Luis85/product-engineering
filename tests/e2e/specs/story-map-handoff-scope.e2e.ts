import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { nfrCatalogRoute, pbiDetailRoute } from "../../../src/application/backlog";
import { domainModelRoute } from "../../../src/application/domain-model";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { newNoteText } from "../../../src/domain/notes";
import { work } from "../backlog-vault";
import {
  adminFolder,
  adminProject,
  customerFolder,
  customerProject,
  customerRequirement,
} from "../knowledge-vault";
import { customerMapId, seedStoryMapsVault } from "../story-maps-vault";
import { fields } from "../story-map-handoff";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const prdEntity = "knowledge-33333333-3333-4333-8333-000000000551";
const itemEntity = "knowledge-33333333-3333-4333-8333-000000000552";
const neighbor = "knowledge-33333333-3333-4333-8333-000000000553";
const secondHop = "knowledge-33333333-3333-4333-8333-000000000554";
const sibling = "knowledge-33333333-3333-4333-8333-000000000555";
const outsider = "knowledge-33333333-3333-4333-8333-000000000556";
const itemNfr = "nfr-33333333-3333-4333-8333-000000000551";
const mapNfr = "nfr-33333333-3333-4333-8333-000000000552";
const siblingNfr = "nfr-33333333-3333-4333-8333-000000000553";
const outsiderNfr = "nfr-33333333-3333-4333-8333-000000000554";
const entityPath = customerFolder + "/Übergabeauftrag.md";
const itemNfrPath = customerFolder + "/NFR für Fallliste.md";
const mapNfrPath = customerFolder + "/NFR für Übergabe.md";
const pbi = "UC-14";
const itemRoute = pbiDetailRoute(customerProject, pbi);
const mapRoute = storyMapsRoute(customerProject, customerMapId);
const prdRoute = knowledgeDetailRoute(customerProject, customerRequirement);
const mapTarget = { kind: "map", id: customerMapId } as const;
const itemTarget = { kind: "item", id: pbi } as const;
const siblingTarget = { kind: "item", id: "UC-77" } as const;
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const section = () => el("domain-scope");
const dialog = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const peerSelect = () => section().$("select[name=domain-assignment]");
const domainLink = (id: string) => section().$(`[data-domain-scope-link="${id}"]`);
const context = (name: string) => el("story-map-context-" + name);
const nfrLink = (id: string) => browser.$(`${ROOT} [data-nfr-open-record="${id}"]`);
const targetLink = (key: string) => browser.$(`${ROOT} [data-nfr-open-target="${key}"]`);
const origin = (key: string) => browser.$(`${ROOT} [data-pe-focus-key="${key}"]`);

async function attributes(path: string): Promise<Record<string, unknown>> {
  return fields((await readVaultText(path)) ?? "");
}

async function assign(id: string) {
  await expect(section()).toBeDisplayed();
  await expect(peerSelect()).toBeDisplayed();
  await peerSelect().selectByAttribute("value", id);
  await section().$("button[type=submit]").click();
  await expect(domainLink(id)).toBeDisplayed();
}

async function unassign(id: string) {
  await section()
    .$(`li:has([data-domain-scope-link="${id}"]) [data-domain-remove-assignment]`)
    .click();
  await expect(domainLink(id)).not.toExist();
}

async function openContext(name: string) {
  const button = context(name);
  await expect(button).toBeDisplayed();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}

async function assignNfr(id: string) {
  await el("nfr-assign").click();
  await el("nfr-assignment-picker").$(`input[value="${id}"]`).click();
  await el("nfr-assign-save").click();
  await expect(nfrLink(id)).toBeDisplayed();
}

async function editNfrTarget(id: typeof itemNfr | typeof mapNfr, key: string, expected: boolean) {
  await setViewRoute(nfrCatalogRoute(customerProject, id));
  await el("nfr-target-choices").click();
  const option = dialog().$(`input[value="${key}"]`);
  if (expected) await expect(option).not.toBeSelected();
  else await expect(option).toBeSelected();
  await option.click();
  await el("nfr-editor-save").click();
  await expect(dialog()).not.toExist();
  const path = id === itemNfr ? itemNfrPath : mapNfrPath;
  await browser.waitUntil(async () => {
    const targets = (await attributes(path)).targets;
    return Array.isArray(targets) && Boolean(targets.length) === expected;
  });
  await browser.waitUntil(() =>
    browser.executeObsidian(
      ({ app }, recordPath, linked) => {
        const note = app.vault.getFileByPath(recordPath);
        const targets: unknown = note && app.metadataCache.getFileCache(note)?.frontmatter?.targets;
        return Array.isArray(targets) && Boolean(targets.length) === linked;
      },
      path,
      expected,
    ),
  );
  await setViewRoute(key.startsWith("map:") ? mapRoute : itemRoute);
  if (key.startsWith("map:")) await openContext("nfrs");
  if (expected) await expect(nfrLink(id)).toBeDisplayed();
  else await expect(nfrLink(id)).not.toExist();
  await setViewRoute(nfrCatalogRoute(customerProject));
  await origin("nfr-" + id).click();
  await expect(el("nfr-editor")).toBeDisplayed();
  if (expected) await expect(targetLink(key)).toBeDisplayed();
  else await expect(targetLink(key)).not.toExist();
}

before(async () => {
  await seedStoryMapsVault();
  const edge = {
    id: "REL-52",
    target: neighbor,
    verb: "umfasst",
    sourceCardinality: "1",
    targetCardinality: "0..*",
    rule: "Nur Fälle der gewählten Organisation.",
  };
  const entities = [
    [prdEntity, "ENT-51", "Übergabeauftrag", { domain_edges: [edge] }],
    [itemEntity, "ENT-52", "Filterschritt", {}],
    [
      neighbor,
      "ENT-53",
      "Servicefenster",
      {
        domain_attributes: [{ name: "Zeitbudget", description: "Nicht Teil des Übergabeumfangs" }],
        domain_edges: [{ ...edge, id: "REL-53", target: secondHop, verb: "verwendet" }],
      },
    ],
    [secondHop, "ENT-54", "Interner Skalierungsplan", {}],
    [sibling, "ENT-55", "Nicht zugeordneter Geschwisterfall", { domain_scope: [siblingTarget] }],
  ] as const;
  const records = entities.map(([id, display_id, title, extra]) => ({
    path: customerFolder + "/" + title + ".md",
    raw: newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        project_id: customerProject,
        kind: "entity",
        approval: "approved",
        id,
        display_id,
        title,
        ...extra,
      },
      "Beschreibung für " + title,
    ),
  }));
  records.push(
    {
      path: adminFolder + "/Externer Übergabeauftrag.md",
      raw: newNoteText(
        {
          schema: "product-engineering.knowledge/v1",
          project_id: adminProject,
          kind: "entity",
          approval: "approved",
          id: outsider,
          display_id: "ENT-51",
          title: "Externer Übergabeauftrag",
          domain_scope: [mapTarget, itemTarget],
        },
        "Anderes Projekt",
      ),
    },
    {
      path: work + "/UC-77.md",
      raw: newNoteText(
        {
          schema: "product-engineering.backlog/v1",
          project_id: customerProject,
          id: "backlog-33333333-3333-4333-8333-000000000557",
          "pe-id": siblingTarget.id,
          title: "Separater Geschwisterfall",
          type: "PBI",
          parent: "[[Servicefälle verwalten]]",
        },
        "",
      ),
    },
  );
  const nfrs = [
    [itemNfrPath, itemNfr, customerProject, "Transparenz beim Filtern", []],
    [mapNfrPath, mapNfr, customerProject, "Übergabe mit Zeitstempel", []],
    [
      customerFolder + "/NFR für Geschwisterfall.md",
      siblingNfr,
      customerProject,
      "NFR des Geschwisterfalls",
      [siblingTarget],
    ],
    [
      adminFolder + "/NFR fremd.md",
      outsiderNfr,
      adminProject,
      "Projektfremde NFR",
      [mapTarget, itemTarget],
    ],
  ] as const;
  for (const [path, id, project_id, title, targets] of nfrs) {
    records.push({
      path,
      raw: newNoteText(
        {
          schema: "product-engineering.nfr/v1",
          project_id,
          id,
          title,
          requirement: "Die Ausführung bleibt nachvollziehbar.",
          acceptance: "Ein freigegebener Datensatz hat einen Zeitstempel.",
          categories: [],
          targets,
        },
        "",
      ),
    });
  }
  await browser.executeObsidian(async ({ app }, files) => {
    for (const { path, raw } of files) await app.vault.create(path, raw);
  }, records);
  await openView();
});

it("edits the installed entity and edge and assigns the live PRD, map and PBI from both sides", async () => {
  await setViewRoute(prdRoute);
  await assign(prdEntity);
  await domainLink(prdEntity).click();
  await expect(domainLink(customerRequirement)).toBeDisplayed();
  await el("knowledge-edit").click();
  await browser
    .$(`${ROOT} textarea[name=markdown]`)
    .setValue("Ein Übergabeauftrag umfasst offene Fälle.");
  await el("knowledge-save").click();
  await expect(el("knowledge-save")).toBeDisabled();
  await unassign(customerRequirement);
  await assign(customerRequirement);
  await assign(customerMapId);
  await domainLink(customerMapId).click();
  await openContext("entities");
  await expect(context("entities")).toHaveText(expect.stringContaining("1"));
  await unassign(prdEntity);
  await assign(prdEntity);
  await expect(origin("story-entity-" + prdEntity + "-" + customerRequirement)).not.toExist();
  await setViewRoute(itemRoute);
  await el("pbi-tab-links").click();
  await assign(itemEntity);
  await domainLink(itemEntity).click();
  await expect(domainLink(pbi)).toBeDisplayed();
  await unassign(pbi);
  await assign(pbi);
  await domainLink(pbi).click();
  await el("pbi-tab-links").click();
  await expect(domainLink(itemEntity)).toBeDisplayed();
  expect(await attributes(entityPath)).toMatchObject({
    domain_scope: [{ kind: "prd", id: customerRequirement }, mapTarget],
  });
  await setViewRoute(domainModelRoute(customerProject, "REL-52"));
  await el("domain-edit-edge").click();
  await dialog().$("[name=sourceCardinality]").selectByAttribute("value", "0..1");
  await dialog().$("[name=targetCardinality]").selectByAttribute("value", "1..*");
  await dialog().$("[name=rule]").setValue("Mindestens ein freigegebenes Servicefenster.");
  await dialog().$("button[type=submit]").click();
  await expect(el("domain-inspector")).toHaveText(
    expect.stringContaining("Mindestens ein freigegebenes Servicefenster."),
  );
  expect(await attributes(entityPath)).toMatchObject({
    domain_edges: [
      { id: "REL-52", target: neighbor, sourceCardinality: "0..1", targetCardinality: "1..*" },
    ],
  });
  expect(await readVaultText(entityPath)).toContain("Ein Übergabeauftrag umfasst offene Fälle.");
});

it("links item and map NFRs both ways and resolves only project-local origins and a single relationship hop", async () => {
  await setViewRoute(itemRoute);
  await assignNfr(itemNfr);
  await nfrLink(itemNfr).click();
  await expect(targetLink("item:" + pbi)).toBeDisplayed();
  await targetLink("item:" + pbi).click();
  await expect(el("pbi-detail")).toBeDisplayed();
  await editNfrTarget(itemNfr, "item:" + pbi, false);
  await editNfrTarget(itemNfr, "item:" + pbi, true);
  expect(await attributes(itemNfrPath)).toMatchObject({ targets: [itemTarget] });
  await setViewRoute(mapRoute);
  await openContext("nfrs");
  await assignNfr(mapNfr);
  await nfrLink(mapNfr).click();
  await expect(targetLink("map:" + customerMapId)).toBeDisplayed();
  await targetLink("map:" + customerMapId).click();
  await expect(el("story-map-detail")).toBeDisplayed();
  await editNfrTarget(mapNfr, "map:" + customerMapId, false);
  await editNfrTarget(mapNfr, "map:" + customerMapId, true);
  expect(await attributes(mapNfrPath)).toMatchObject({ targets: [mapTarget] });

  await setViewRoute(mapRoute);
  await openContext("foundations");
  await expect(el("story-map-source-prd")).toBeDisplayed();
  await expect(el("story-map-source-job")).toBeDisplayed();
  await el("story-map-source-prd").click();
  await expect(el("knowledge-story-map-backlink")).toBeDisplayed();
  await el("project-record-return").click();
  await openContext("prototypes");
  await expect(el("story-map-detail")).toHaveText(
    expect.stringContaining("Keine Prototypen mit dieser Map verknüpft."),
  );
  await openContext("nfrs");
  await expect(origin("nfr-origin-" + itemNfr + "-item:" + pbi)).toBeDisplayed();
  await expect(nfrLink(siblingNfr)).not.toExist();
  await expect(nfrLink(outsiderNfr)).not.toExist();
  await openContext("entities");
  await expect(domainLink(prdEntity)).toBeDisplayed();
  await expect(origin("story-entity-" + itemEntity + "-" + pbi)).toBeDisplayed();
  await expect(origin("story-entity-" + secondHop)).not.toExist();
  await expect(origin("story-entity-" + sibling)).not.toExist();
  await expect(origin("story-entity-" + outsider)).not.toExist();
  await origin("story-entity-" + itemEntity + "-" + pbi).click();
  await expect(el("pbi-detail")).toBeDisplayed();
  await expect(origin("pbi-entity-origin-" + prdEntity + "-" + customerMapId)).toBeDisplayed();
  await expect(origin("nfr-origin-" + mapNfr + "-map:" + customerMapId)).toBeDisplayed();

  for (const target of [itemTarget, mapTarget]) {
    const request = { project: customerProject, target } as const;
    const payload = await browser.executeObsidian(
      ({ plugins }, scope) =>
        plugins.noteStoreProbe.events.productScope(scope.project, scope.target),
      request,
    );
    expect(payload.domain.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: prdEntity,
          origins: expect.arrayContaining([
            expect.objectContaining({ id: customerMapId, kind: "map" }),
            expect.objectContaining({ id: customerRequirement, kind: "prd" }),
          ]),
        }),
        expect.objectContaining({ id: itemEntity, origins: [expect.objectContaining(itemTarget)] }),
      ]),
    );
    for (const id of [neighbor, secondHop, sibling, outsider])
      expect(payload.domain.entities.map((record) => record.id)).not.toContain(id);
    expect(payload.domain.neighbors).toEqual([
      { id: neighbor, title: "Servicefenster", displayId: "ENT-53" },
    ]);
    expect(payload.domain.edges).toMatchObject([
      {
        id: "REL-52",
        source: prdEntity,
        target: neighbor,
        sourceCardinality: "0..1",
        targetCardinality: "1..*",
      },
    ]);
    expect(
      payload.nfrs.map(({ id, sources }) => [
        id,
        sources.map(({ kind, id: source }) => [kind, source]),
      ]),
    ).toEqual([
      [itemNfr, [["item", pbi]]],
      [mapNfr, [["map", customerMapId]]],
    ]);
  }
});

it("archives and restores the referenced entity without discarding its map, PRD or edge identity", async () => {
  await setViewRoute(domainModelRoute(customerProject, prdEntity));
  await el("domain-archive-entity").click();
  await el("domain-confirm").click();
  await expect(browser.$(`${ROOT} [data-domain-node="${prdEntity}"]`)).not.toExist();
  expect(await attributes(entityPath)).toMatchObject({
    domain_archived: true,
    domain_scope: [{ kind: "prd", id: customerRequirement }, mapTarget],
    domain_edges: [{ id: "REL-52", target: neighbor }],
  });
  await setViewRoute(mapRoute);
  await openContext("entities");
  await expect(domainLink(prdEntity)).toHaveText(expect.stringContaining("Archiviert"));
  await domainLink(prdEntity).click();
  await expect(el("knowledge-note-header").$("h1")).toHaveText("Übergabeauftrag");
  await el("domain-restore-entity").click();
  await expect(el("domain-restore-entity")).not.toExist();
  expect(await attributes(entityPath)).toMatchObject({
    domain_scope: [{ kind: "prd", id: customerRequirement }, mapTarget],
    domain_edges: [{ id: "REL-52", target: neighbor }],
  });
  await domainLink(customerMapId).click();
  await openContext("entities");
  await expect(domainLink(prdEntity)).not.toHaveText(expect.stringContaining("Archiviert"));
});
