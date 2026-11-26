import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { renameSync } from "node:fs";
import { join } from "node:path";
import { domainModelRoute } from "../../../src/application/domain-model";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { projectOverviewRoute } from "../../../src/application/projects";
import { isKnowledgeId } from "../../../src/domain/knowledge";
import {
  adminProject,
  customerFolder,
  customerProject,
  seedKnowledgeVault,
} from "../knowledge-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";

const element = (id: string) => browser.$(`${ROOT} [data-testid=${id}]`);

before(seedKnowledgeVault);

it("opens the empty domain model directly below Knowledge in the native project", async () => {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setViewRoute(projectOverviewRoute(customerProject));
  const entry = element("project-rail").$(
    "[data-pe-focus-key=project-knowledge] + [data-pe-focus-key=project-domainmodel]",
  );
  await expect(element("project-knowledge-entry")).toBeDisplayed();
  await expect(entry).toBeDisplayed();
  await entry.click();
  await expect(element("domain-model").$("h1")).toHaveText("Domainmodel");
  await expect(element("domain-empty")).toBeDisplayed();
});

const dialog = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const organisation = `${customerFolder}/Organisation.md`;

async function createEntity(title: string, definition: string, attribute?: string) {
  await expect(element("domain-create-entity")).toBeDisplayed();
  await element("domain-create-entity").click();
  await dialog().$("[name=title]").setValue(title);
  await dialog().$("[name=definition]").setValue(definition);
  if (attribute) {
    await element("domain-add-attribute").click();
    await dialog().$("[name=attribute-name]").setValue(attribute);
    await dialog().$("[name=attribute-description]").setValue("Interne Referenz");
  }
  await dialog().$("button[type=submit]").click();
  await expect(element("domain-inspector").$("h2")).toHaveText(title);
}

it("creates one entity note with authored Markdown and a named attribute and opens it from Domainmodel", async () => {
  await createEntity("Organisation", "Eine Organisation meldet Servicefälle.", "Kundennummer");
  const bytes = await readVaultText(organisation);
  expect(bytes).toContain("schema: product-engineering.knowledge/v1");
  expect(bytes).toContain("display_id: ENT-01");
  expect(bytes).toContain("domain_attributes:");
  expect(bytes).toContain("Kundennummer");
  expect(bytes).toContain("Eine Organisation meldet Servicefälle.");
  await element("domain-knowledge-note").click();
  await expect(element("knowledge-note-header").$("h1")).toHaveText("Organisation");
  await expect(element("knowledge-file")).toHaveAttribute("data-note-path", organisation);
  await element("knowledge-edit").click();
  const changed = "Eine Organisation meldet und prüft Servicefälle.";
  await browser.$(`${ROOT} textarea[name=markdown]`).setValue(changed);
  await element("knowledge-save").click();
  await expect(element("knowledge-save")).toBeDisabled();
  expect(await readVaultText(organisation)).toContain(changed);
  await element("project-record-return").click();
  await expect(element("domain-inspector").$("h2")).toHaveText("Organisation");
  await expect(element("domain-inspector")).toHaveText(expect.stringContaining(changed));
});

it("writes a directed relationship to the source note and reopens the same edge by stable selection", async () => {
  await createEntity("Servicefall", "Der Servicefall hält die Anfrage fest.");
  await setViewRoute(domainModelRoute(customerProject, "ENT-01"));
  await expect(element("domain-inspector").$("h2")).toHaveText("Organisation");
  await expect(element("domain-create-edge")).toBeDisplayed();
  await element("domain-create-edge").click();
  const source = dialog().$("[name=source]");
  const target = dialog().$("[name=target]");
  await expect(source.$("option:checked")).toHaveText(expect.stringContaining("Organisation"));
  await target.selectByVisibleText("Servicefall · ENT-02");
  await dialog().$("[name=verb]").setValue("meldet");
  await dialog().$("[name=sourceCardinality]").selectByAttribute("value", "1");
  await dialog().$("[name=targetCardinality]").selectByAttribute("value", "0..*");
  await dialog().$("[name=rule]").setValue("Nach bestätigter Freigabe");
  await dialog().$("button[type=submit]").click();
  await expect(element("domain-inspector").$("h2")).toHaveText("meldet");
  const bytes = await readVaultText(organisation);
  const identity = /REL-[a-f0-9-]+/.exec(bytes ?? "")?.[0];
  expect(identity).toBeTruthy();
  expect(bytes).toContain("Nach bestätigter Freigabe");
  expect(await readVaultText(`${customerFolder}/Servicefall.md`)).not.toContain("domain_edges");
  const stable = domainModelRoute(customerProject, identity);
  expect(await readViewRoute()).toEqual(stable);
  await setViewRoute(domainModelRoute(customerProject, "ENT-02"));
  await setViewRoute(stable);
  await expect(element("domain-inspector")).toHaveText(
    expect.stringContaining("Nach bestätigter Freigabe"),
  );
});

async function geometry() {
  return browser.execute((root) => {
    const viewport = document.querySelector(`${root} [data-testid=domain-viewport]`);
    const view = viewport?.getBoundingClientRect();
    const world = viewport?.querySelector<HTMLElement>("[data-domain-world]");
    const stage = world?.getBoundingClientRect();
    if (!view || !stage) return null;
    return {
      x: Math.round(view.left + view.width * 0.38),
      y: Math.round(view.top + 30),
      left: stage.left,
      top: stage.top,
      zoom: Number(world?.dataset.zoom),
    };
  }, ROOT);
}

it("anchors an ordinary wheel at the real canvas pointer and retains the view when selecting a relationship", async () => {
  await expect(element("domain-viewport")).toBeDisplayed();
  const original = await geometry();
  if (!original) throw new Error("Missing domain canvas geometry");
  await browser.sendCommandAndGetResult("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: original.x,
    y: original.y,
    deltaX: 0,
    deltaY: -220,
  });
  await browser.waitUntil(async () => ((await geometry())?.zoom ?? 0) > original.zoom + 0.1);
  const after = await geometry();
  if (!after) throw new Error("Missing transformed domain canvas");
  expect((original.x - original.left) / original.zoom).toBeCloseTo(
    (original.x - after.left) / after.zoom,
    1,
  );
  expect((original.y - original.top) / original.zoom).toBeCloseTo(
    (original.y - after.top) / after.zoom,
    1,
  );
  await element("domain-edges").$("[data-domain-edge-row]").click();
  expect((await geometry())?.zoom).toBe(after.zoom);
});

it("keeps independent project cameras across native re-entry and reload without touching note bytes", async () => {
  const customerView = await geometry();
  if (!customerView) throw new Error("Missing customer canvas");
  expect(customerView.zoom).toBeGreaterThan(1.1);
  const bytes = await readVaultText(organisation);
  await setViewRoute(domainModelRoute(adminProject));
  await createEntity("Kontenverwaltung", "Verwaltet getrennte Administrationskonten.");
  expect((await geometry())?.zoom).toBe(1);
  const adminView = await geometry();
  if (!adminView) throw new Error("Missing admin canvas");
  await browser.sendCommandAndGetResult("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: adminView.x,
    y: adminView.y,
    deltaX: 0,
    deltaY: 180,
  });
  await browser.waitUntil(async () => ((await geometry())?.zoom ?? 1) < 0.95);
  const otherZoom = (await geometry())?.zoom;
  await setViewRoute(domainModelRoute(customerProject, "ENT-01"));
  await expect(element("domain-inspector").$("h2")).toHaveText("Organisation");
  expect((await geometry())?.zoom).toBe(customerView.zoom);
  await setViewRoute(domainModelRoute(adminProject, "ENT-01"));
  await expect(element("domain-inspector").$("h2")).toHaveText("Kontenverwaltung");
  expect((await geometry())?.zoom).toBe(otherZoom);
  await setViewRoute(domainModelRoute(customerProject, "ENT-01"));
  const storedRoute = JSON.stringify(domainModelRoute(customerProject, "ENT-01"));
  await browser.waitUntil(
    async () =>
      (await readVaultText(".obsidian/workspace.json"))?.replace(/\s/g, "").includes(storedRoute) ??
      false,
  );
  await browser.reloadObsidian();
  await expect(element("domain-inspector").$("h2")).toHaveText("Organisation");
  expect((await geometry())?.zoom).toBe(customerView.zoom);
  expect(await readVaultText(organisation)).toBe(bytes);
});

it("follows an external entity file rename to the exact stable Knowledge record", async () => {
  const original = await readVaultText(organisation);
  if (!original) throw new Error("Missing the saved entity note");
  const id = /^id: (.+)$/m.exec(original)?.[1];
  if (!isKnowledgeId(id)) throw new Error("Missing entity Knowledge ID");
  const renamed = customerFolder + "/Organisation extern.md";
  const vault = browser.getObsidianPage().getVaultPath();
  renameSync(join(vault, organisation), join(vault, renamed));
  await browser.waitUntil(() =>
    browser.executeObsidian(({ app }, path) => Boolean(app.vault.getFileByPath(path)), renamed),
  );
  await setViewRoute(domainModelRoute(customerProject, id));
  await expect(element("domain-inspector").$("h2")).toHaveText("Organisation");
  await element("domain-knowledge-note").click();
  await expect(element("knowledge-file")).toHaveAttribute("data-note-path", renamed);
  expect(await readViewRoute()).toEqual(
    knowledgeDetailRoute(customerProject, id, {
      section: "domainmodel",
      reference: { kind: "entity", recordId: id },
    }),
  );
  expect(await readVaultText(renamed)).toBe(original);
  expect(await readVaultText(organisation)).toBeNull();
});
