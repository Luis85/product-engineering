import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { renameSync } from "node:fs";
import { join } from "node:path";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { catalogFor } from "../../../src/application/messages";
import { appRoutes } from "../../../src/application/routes";
import { isKnowledgeId } from "../../../src/domain/knowledge";
import { splitNoteText } from "../../../src/domain/notes";
import { isProjectId } from "../../../src/domain/projects";
import { guide, image, seedKnowledgeDetailVault } from "../knowledge-detail-vault";
import { adminProject } from "../knowledge-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
  writeVaultText,
} from "../support";

const text = catalogFor(TEST_LANGUAGE);
const projectName = "Übergabe Projekt";
const folder = "Product Engineering/Projects/" + projectName;
const humanTitle = "Servicevertretung";
const systemTitle = "Freigabedienst";
const humanPath = folder + "/" + humanTitle + ".md";
const systemPath = folder + "/" + systemTitle + ".md";
const renamed = folder + "/Freigabedienst extern.md";
const unknown = "partner_metadata: [Nord, Süd] # Externe Felder";
const editorSelector = `${ROOT} textarea[name=markdown]`;
const button = (name: string) => browser.$(`${ROOT} [data-testid="${name}"]`);
const modal = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const editor = () => browser.$(editorSelector);

before(seedKnowledgeDetailVault);

async function stored(path: string) {
  const raw = await readVaultText(path);
  if (!raw) throw new Error("Expected a saved fixture note at " + path);
  return raw;
}

async function newActor(title: string, subtype: "human" | "system") {
  await button("knowledge-library")
    .$("select[name=knowledge-filter]")
    .selectByAttribute("value", "actor");
  await button("knowledge-create").click();
  await modal().$("input[name=title]").setValue(title);
  await modal().$("select[name=actor_type]").selectByAttribute("value", subtype);
  await expect(modal().$("select[name=owner_id]")).toHaveValue("");
  await modal().$("button[type=submit]").click();
  await expect(editor()).toBeFocused();
  const path = `${folder}/${title}.md`;
  const raw = await stored(path);
  const identity = /^id: (.+)$/m.exec(raw)?.[1];
  if (!isKnowledgeId(identity)) throw new Error("Missing Knowledge identity");
  const yaml = splitNoteText(raw).frontmatter?.yaml;
  expect(yaml).toContain("actor_type: " + subtype);
  expect(yaml).not.toContain("owner_id:");
  return identity;
}

async function pickFile(path: string) {
  await modal().$("input[type=search]").setValue(path);
  await modal()
    .$(`[data-vault-file=${JSON.stringify(path)}]`)
    .click();
}

async function acceptFile() {
  await modal().$("[data-testid=knowledge-vault-confirm]").click();
  await expect(modal()).not.toBeDisplayed();
}

it("J01 creates both unassigned actors, reconciles external Vault changes and restores collapsed project context", async function () {
  this.timeout(120_000);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 820,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setViewRoute(appRoutes.start);
  await button("project-workspace").$(`button=${text.projects.create}`).click();
  await modal().$("input[name=name]").setValue(projectName);
  await modal().$("input[name=description]").setValue("Übergabe zwischen Teams");
  await modal().$("input[name=repository]").setValue("fixtures/handoff");
  await modal().$("button[type=submit]").click();
  await expect(button("project-workspace").$("h1")).toHaveText(projectName);
  const route = await readViewRoute();
  if (
    !route ||
    typeof route !== "object" ||
    !("projectId" in route) ||
    !isProjectId(route.projectId)
  ) {
    throw new Error("Missing project identity");
  }
  const projectId = route.projectId;
  expect(await stored(folder + "/Project.md")).toContain(projectId);
  await button("project-knowledge-entry").click();
  const human = await newActor(humanTitle, "human");
  await button("project-record-return").click();
  const system = await newActor(systemTitle, "system");
  await button("project-record-return").click();

  const source = (await stored(humanPath)).replace(
    "approval: draft",
    "approval: draft\n" + unknown,
  );
  await writeVaultText(humanPath, source);
  await browser.waitUntil(() =>
    browser.executeObsidian(({ app }, path) => {
      const file = app.vault.getFileByPath(path);
      return Boolean(file && app.metadataCache.getFileCache(file)?.frontmatter?.partner_metadata);
    }, humanPath),
  );
  await button("knowledge-library").$(`[data-knowledge-record="${human}"]`).click();
  await button("knowledge-edit").click();
  await editor().setValue("Vergleiche Originaltext.");
  await browser.execute((selector) => {
    const field = document.querySelector<HTMLTextAreaElement>(selector);
    if (!field) throw new Error("Missing Markdown field");
    const selection = "Originaltext";
    const start = field.value.indexOf(selection);
    field.setSelectionRange(start, start + selection.length);
  }, editorSelector);
  await button("knowledge-insert-link").click();
  await pickFile(guide);
  await expect(modal().$("input[name=vault-alias]")).toHaveValue("Originaltext");
  await modal().$("select[name=vault-heading]").selectByAttribute("value", "#Fundstelle");
  await acceptFile();
  await browser.execute((selector) => {
    const field = document.querySelector<HTMLTextAreaElement>(selector);
    field?.setSelectionRange(field.value.length, field.value.length);
  }, editorSelector);
  await button("knowledge-insert-image").click();
  await pickFile(image);
  await acceptFile();
  await button("knowledge-save").click();
  await expect(button("knowledge-save")).toBeDisabled();
  await button("knowledge-references-tab").click();
  await button("knowledge-add-reference").click();
  await pickFile(systemPath);
  await acceptFile();
  await button("knowledge-save").click();
  await expect(button("knowledge-explicit-references").$("li button:first-child")).toBeDisplayed();
  const linked = await stored(humanPath);
  expect(linked).toContain(unknown);
  expect(splitNoteText(linked).body).toContain("#Fundstelle|Originaltext]]");
  expect(splitNoteText(linked).body).toContain("![[");
  expect(splitNoteText(linked).frontmatter?.yaml).toContain(systemPath);

  const vault = browser.getObsidianPage().getVaultPath();
  renameSync(join(vault, systemPath), join(vault, renamed));
  await browser.waitUntil(() =>
    browser.executeObsidian(({ app }, path) => Boolean(app.vault.getFileByPath(path)), renamed),
  );
  await button("project-record-return").click();
  await button("knowledge-library").$(`[data-knowledge-record="${system}"]`).click();
  await expect(button("knowledge-file")).toHaveAttribute("data-note-path", renamed);
  expect(await readViewRoute()).toMatchObject(knowledgeDetailRoute(projectId, system));
  expect(await readVaultText(systemPath)).toBeNull();
  expect(await stored(renamed)).toContain("actor_type: system");

  await button("project-record-return").click();
  await button("knowledge-library").$(`[data-knowledge-record="${human}"]`).click();
  await button("knowledge-references-tab").click();
  await expect(button("knowledge-explicit-references")).toHaveText(
    expect.stringContaining(text.knowledge.note.unresolved),
  );
  await button("knowledge-explicit-references")
    .$(`button=${text.knowledge.note.removeReference}`)
    .click();
  await button("knowledge-add-reference").click();
  await pickFile(renamed);
  await acceptFile();
  await button("knowledge-save").click();
  await expect(button("knowledge-explicit-references").$("li button:first-child")).toHaveText(
    expect.stringContaining(renamed),
  );

  await button("knowledge-edit").click();
  await editor().setValue("Lokaler Entwurf");
  const latest = (await stored(humanPath)) + "\nAus dem Dateisystem geändert.\n";
  await writeVaultText(humanPath, latest);
  await expect(button("knowledge-conflict")).toBeDisplayed();
  await expect(editor()).toHaveValue("Lokaler Entwurf");
  await button("knowledge-save").click();
  expect(await stored(humanPath)).toBe(latest);
  await button("knowledge-reload").click();
  await expect(editor()).toHaveValue(expect.stringContaining("Aus dem Dateisystem geändert."));
  await button("knowledge-content-tab").click();
  await expect(button("knowledge-body").$("a.internal-link=Originaltext")).toBeDisplayed();
  await expect(button("knowledge-body").$("img")).toBeDisplayed();
  const host = await browser.executeObsidian(
    async ({ app }, path, link) => {
      const file = app.vault.getFileByPath(path);
      return (
        file && {
          raw: await app.vault.read(file),
          target: app.metadataCache.getFirstLinkpathDest(link, path)?.path,
        }
      );
    },
    humanPath,
    guide.replace(/\.md$/, ""),
  );
  expect(host).toEqual({ raw: latest, target: guide });

  const rail = button("project-rail");
  await rail.$(`button[aria-label=${JSON.stringify(text.projects.collapse)}]`).click();
  await rail.$("[data-pe-focus-key=project-picker]").click();
  await modal().$('button[aria-label="Admin Console"]').click();
  expect(await readViewRoute()).toMatchObject({ projectId: adminProject });
  await button("frame-history")
    .$(`button[aria-label=${JSON.stringify(text.shell.frame.back)}]`)
    .click();
  await expect(button("knowledge-note-header").$("h1")).toHaveText(humanTitle);
  await expect(
    rail.$(`button[aria-label=${JSON.stringify(text.projects.expand)}]`),
  ).toBeDisplayed();
  expect(await readViewRoute()).toMatchObject(knowledgeDetailRoute(projectId, human));
  await browser.waitUntil(
    async () => (await readVaultText(".obsidian/workspace.json"))?.includes(human) ?? false,
  );
  await browser.reloadObsidian();
  await expect(button("knowledge-note-header").$("h1")).toHaveText(humanTitle);
  await expect(button("knowledge-note-header")).toHaveText(
    expect.stringContaining(text.knowledge.unassigned),
  );
  await expect(button("knowledge-body").$("a.internal-link=Originaltext")).toBeDisplayed();
  await button("knowledge-references-tab").click();
  await expect(button("knowledge-explicit-references").$("li button:first-child")).toHaveText(
    expect.stringContaining(renamed),
  );
  expect(await stored(humanPath)).toBe(latest);
});
