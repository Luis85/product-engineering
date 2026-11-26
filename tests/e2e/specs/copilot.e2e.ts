import { browser, expect } from "@wdio/globals";
import { afterEach, before, it } from "mocha";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { projectOverviewRoute } from "../../../src/application/projects";
import { newNoteText } from "../../../src/domain/notes";
import {
  createProviderFixture,
  finishProviderCall,
  installProviderFixture,
  readProviderCalls,
  streamProviderText,
} from "../ai-provider-fixture";
import { prdPath } from "../knowledge-detail-vault";
import { otherFile, seedKnowledgeGitVault, untrackedFile } from "../knowledge-git-vault";
import {
  adminProject,
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
} from "../knowledge-vault";
import {
  disablePlugin,
  enablePlugin,
  installConsoleSpy,
  openView,
  pluginProblems,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
  VIEW_TYPE,
  writeDataFile,
  writeVaultText,
} from "../support";

const primary = knowledgeDetailRoute(customerProject, customerRequirement);
const panel = () => browser.$(`${ROOT} [data-testid=copilot-workspace]`);
const control = (id: string) => browser.$(`${ROOT} [data-testid=${id}]`);
const inside = (id: string) => panel().$(`[data-testid=${id}]`);
const activeLog = () => panel().$("[role=log]");
let provider: Awaited<ReturnType<typeof createProviderFixture>>;
let repo: Awaited<ReturnType<typeof seedKnowledgeGitVault>>;

async function openReview() {
  await control("knowledge-note-actions").waitForDisplayed();
  await control("knowledge-note-actions").click();
  await control("knowledge-ai-review").click();
  await panel().waitForDisplayed();
}

async function enableCli() {
  await writeDataFile({
    schemaVersion: 1,
    aiEnabled: true,
    aiMode: "codex",
    codexPath: provider.codexPath,
  });
  await reloadPlugin();
  await openView();
  await setViewRoute(primary);
}

async function submit(prompt: string, call: number) {
  await inside("copilot-prompt").setValue(prompt);
  await panel().$("button[type=submit]").click();
  await browser.waitUntil(
    async () => (await readProviderCalls())[call]?.input.includes(prompt) === true,
  );
}

async function chooseTask(value: string) {
  await inside("copilot-mode").selectByAttribute("value", value);
}

async function openDirtySplit() {
  await browser.executeObsidian(
    async ({ app }, type, route) => {
      const original = app.workspace.getLeavesOfType(type)[0];
      if (!original) throw new Error("Expected original Copilot leaf");
      const split = app.workspace.getLeaf("split", "vertical");
      await split.setViewState({ type, active: true, state: { route } });
      split.view.containerEl.dataset.copilotDirtyLeaf = "true";
      await app.workspace.revealLeaf(original);
    },
    VIEW_TYPE,
    primary,
  );
  const dirtyLeaf = browser.$("[data-copilot-dirty-leaf=true]");
  await dirtyLeaf.$("[data-testid=knowledge-edit]").waitForDisplayed();
  await dirtyLeaf.$("[data-testid=knowledge-edit]").click();
  const editor = dirtyLeaf.$("textarea[name=markdown]");
  await editor.setValue("Ungespeicherter Arbeitsstand im geteilten Blatt.");
  return editor;
}

async function closeDirtySplit() {
  await browser.executeObsidian(({ app }, type) => {
    app.workspace
      .getLeavesOfType(type)
      .find(({ view }) => view.containerEl.dataset.copilotDirtyLeaf === "true")
      ?.detach();
  }, VIEW_TYPE);
}

before(async () => {
  await installConsoleSpy();
  repo = await seedKnowledgeGitVault();
  await writeVaultText("Private-notes.md", "Nicht ausgewählte private Datei.");
  await writeVaultText(
    customerFolder + "/PT-77.md",
    newNoteText(
      {
        schema: "product-engineering.prototype/v1",
        id: "prototype-33333333-3333-4333-8333-000000000977",
        project_id: customerProject,
        title: "Importierter Prototyp",
        display_id: "PT-77",
        revision: 1,
        output_html: "<main>PROTOTYPE-HTML-SENTINEL</main>",
        output_provenance: "import",
      },
      "",
    ),
  );
  provider = await createProviderFixture();
  await writeDataFile({ schemaVersion: 1, codexPath: provider.codexPath });
  await reloadPlugin();
  await openView();
  await setViewRoute(primary);
});

afterEach(async () => {
  expect(await pluginProblems()).toEqual([]);
});

it("opens a consent-guarded scoped review, survives reload, and reopens citations in native work", async () => {
  await control("knowledge-note-actions").waitForDisplayed();
  await control("knowledge-note-actions").click();
  await expect(control("knowledge-ai-review")).not.toExist();
  expect(await readProviderCalls()).toEqual([]);
  await enableCli();
  await openReview();
  expect(await readViewRoute()).toEqual(primary);
  await expect(inside("copilot-mode")).toHaveValue("review");
  const selected = () => panel().$$("input[data-testid=copilot-source]:checked");
  await browser.waitUntil(async () => (await selected()).length === 1);
  expect(await (await selected())[0]?.getValue()).toBe("knowledge:" + customerRequirement);
  expect(await panel().$$("[data-testid=copilot-thread] option")).toHaveLength(1);
  expect(await readProviderCalls()).toEqual([]);
  await panel().$("summary=Projekthinweise").click();
  await panel().$("textarea[aria-label=Projekthinweise]").setValue("Für die Frühschicht arbeiten.");
  expect(await readProviderCalls()).toEqual([]);
  await submit("Prüfe den aktuellen Übergabestand.", 0);
  const payload = (await readProviderCalls())[0]?.input;
  expect(payload).toContain("Für die Frühschicht arbeiten.");
  expect(payload).toContain("Neue Übergaberegel.");
  for (const absent of [
    "Vertrauliche Admin-Daten",
    "Nicht ausgewählte private Datei",
    "PROTOTYPE-HTML-SENTINEL",
    "Produktvision Kundenportal",
    "Authorization",
    "mcpToken",
  ])
    expect(payload).not.toContain(absent);
  await finishProviderCall(
    0,
    "### Kontrollierte Prüfung\n\n**Beleg** für die Übergabe.\n\n![Bild](https://example.invalid/pixel.png)",
  );
  await expect(activeLog().$("h4")).toHaveText("Kontrollierte Prüfung");
  await expect(activeLog().$("img")).not.toExist();
  await expect(inside("copilot-source-link")).toBeDisplayed();
  await submit("Prüfe die verbleibende Entscheidung.", 1);
  await finishProviderCall(1, "Zweiter dokumentierter Beleg.");
  await expect(activeLog()).toHaveText(expect.stringContaining("Zweiter dokumentierter Beleg."));
  await inside("copilot-prompt").setValue("Ein ungesendeter Entwurf.");
  await browser.waitUntil(() =>
    browser.executeObsidian(
      async ({ app }, id) => {
        const file = app.vault.getMarkdownFiles().find(({ basename }) => basename === id);
        return file ? (await app.vault.read(file)).includes("Ein ungesendeter Entwurf.") : false;
      },
      "copilot-" + customerProject.slice("project-".length),
    ),
  );
  await reloadPlugin();
  await openView();
  await setViewRoute(primary);
  await openReview();
  await expect(inside("copilot-prompt")).toHaveValue("Ein ungesendeter Entwurf.");
  await expect(activeLog().$("h4")).toHaveText("Kontrollierte Prüfung");
  const citations = await activeLog().$$("[data-testid=copilot-source-link]");
  expect(citations).toHaveLength(2);
  const firstCitation = citations[0];
  if (!firstCitation) throw new Error("Expected the earlier reply's native citation");
  await firstCitation.click();
  expect(await readProviderCalls()).toHaveLength(2);
  await expect(panel()).not.toExist();
  expect(await readViewRoute()).toEqual(primary);
  await expect(control("knowledge-note-header").$("h1")).toBeFocused();

  await setViewRoute(knowledgeDetailRoute(customerProject, jobOne));
  await openReview();
  await expect(control("copilot-selected-sources")).toHaveText(
    "JOB-12 · Offene Fälle verlässlich übergeben",
  );
  await expect(inside("copilot-mode")).toHaveValue("review");
  await expect(activeLog()).not.toHaveText(expect.stringContaining("Kontrollierte Prüfung"));
  await expect(inside("copilot-thread")).toHaveValue("");
  expect(await readProviderCalls()).toHaveLength(2);
  await browser.keys("Escape");
  await setViewRoute(primary);
});

it("applies an edited PRD once and protects a dirty split and a saved competing revision", async () => {
  await installProviderFixture(provider.paths);
  await openReview();
  await chooseTask("draft");
  await inside("copilot-draft-kind").selectByAttribute("value", "prd");
  await submit("Schreibe einen neuen PRD-Entwurf.", 0);
  const head = repo.head();
  const outside = repo.read(otherFile);
  const original = await readVaultText(prdPath);
  await finishProviderCall(
    0,
    JSON.stringify({ title: "Generierter PRD", body: "## {{REQ}}\n\nGenerierter Beleg." }),
  );
  await inside("copilot-proposal-title").waitForDisplayed();
  expect(await readVaultText(prdPath)).toBe(original);
  await inside("copilot-proposal-title").setValue("Editierter PRD");
  await inside("copilot-apply").click();
  await expect(control("knowledge-note-header").$("h1")).toHaveText("Editierter PRD");
  const generated = await browser.executeObsidian(
    ({ app }, folder) =>
      app.vault
        .getMarkdownFiles()
        .filter(({ path }) => path.startsWith(folder + "/Editierter PRD"))
        .map(({ path }) => path),
    customerFolder,
  );
  expect(generated).toHaveLength(1);
  if (!generated[0]) throw new Error("Missing generated note");
  const written = await readVaultText(generated[0]);
  expect(written).toContain("source_links:");
  expect(written).toContain(customerRequirement);
  expect(written).toContain("approval: draft");

  await setViewRoute(primary);
  await openReview();
  await chooseTask("revise");
  await inside("copilot-revision-target").selectByAttribute(
    "value",
    "knowledge:" + customerRequirement,
  );
  await submit("Überarbeite zunächst die Originalnotiz.", 1);
  await finishProviderCall(
    1,
    JSON.stringify({ title: "Kollidierender Vorschlag", body: "## Vorschlag" }),
  );
  await inside("copilot-proposal-title").waitForDisplayed();
  try {
    const dirty = await openDirtySplit();
    await inside("copilot-apply").click();
    await expect(inside("copilot-save-as-new")).toBeDisplayed();
    await expect(inside("copilot-apply")).toBeDisabled();
    await expect(dirty).toHaveValue("Ungespeicherter Arbeitsstand im geteilten Blatt.");
    expect(await readVaultText(prdPath)).toBe(original);
  } finally {
    await closeDirtySplit();
  }
  await inside("copilot-save-as-new").click();
  await expect(control("knowledge-note-header").$("h1")).toHaveText("Kollidierender Vorschlag");

  await setViewRoute(primary);
  await openReview();
  await chooseTask("revise");
  await inside("copilot-revision-target").selectByAttribute(
    "value",
    "knowledge:" + customerRequirement,
  );
  await submit("Ergänze eine überprüfbare Anforderung.", 2);
  await finishProviderCall(
    2,
    JSON.stringify({ title: "Aktualisierter Übergabestand", body: "## Überprüfbare Anforderung" }),
  );
  await inside("copilot-proposal-title").waitForDisplayed();
  await inside("copilot-apply").click();
  await expect(control("knowledge-note-header").$("h1")).toHaveText("Aktualisierter Übergabestand");
  expect(await readViewRoute()).toEqual(primary);
  expect(await readVaultText(prdPath)).toContain("approval: draft");

  await openReview();
  await chooseTask("revise");
  await inside("copilot-revision-target").selectByAttribute(
    "value",
    "knowledge:" + customerRequirement,
  );
  await submit("Überarbeite die letzte Fassung.", 3);
  await finishProviderCall(
    3,
    JSON.stringify({ title: "Veralteter Vorschlag", body: "## Inzwischen veraltet" }),
  );
  await inside("copilot-proposal-title").waitForDisplayed();
  const competing = (await readVaultText(prdPath)) + "\nZwischenzeitlich extern gespeichert.";
  await writeVaultText(prdPath, competing);
  await inside("copilot-apply").click();
  await expect(inside("copilot-save-as-new")).toBeDisplayed();
  expect(await readVaultText(prdPath)).toBe(competing);
  await browser.keys("Escape");
  expect(repo.head()).toBe(head);
  expect(repo.git("show", ":" + otherFile)).toEqual(repo.stagedOther);
  expect(repo.read(otherFile)).toEqual(outside);
  expect(repo.read(untrackedFile).toString()).toBe("Outside this commit\n");
});

it("cancels target, project and unloaded-leaf requests and rejects late replies", async () => {
  await installProviderFixture(provider.paths);
  await openReview();
  await chooseTask("review");
  await submit("Veralteter Zielwechsel", 0);
  await setViewRoute(knowledgeDetailRoute(customerProject, jobOne));
  await browser.waitUntil(async () => (await readProviderCalls())[0]?.aborted === true);
  await finishProviderCall(0, "VERALTETER-ZIELWECHSEL");
  await expect(activeLog()).not.toHaveText(expect.stringContaining("VERALTETER-ZIELWECHSEL"));
  await submit("Veralteter Projektwechsel", 1);
  await setViewRoute(projectOverviewRoute(adminProject));
  await browser.waitUntil(async () => (await readProviderCalls())[1]?.aborted === true);
  await finishProviderCall(1, "VERALTETER-PROJEKTWECHSEL");
  await browser.$(`${ROOT} button[aria-label="KI-Copilot"]`).click();
  await expect(activeLog()).not.toHaveText(expect.stringContaining("Kontrollierte Prüfung"));
  expect(await panel().$$("[data-testid=copilot-thread] option")).toHaveLength(1);
  await submit("Veraltetes geschlossenes Blatt", 2);
  await disablePlugin();
  await browser.waitUntil(async () => (await readProviderCalls())[2]?.aborted === true);
  await finishProviderCall(2, "VERALTETES-BLATT");
  await expect(panel()).not.toExist();
  await enablePlugin();
});

it("keeps Cancel reachable during a long streamed reply and retries malformed or empty output", async () => {
  await installProviderFixture(provider.paths);
  await openView();
  await setViewRoute(primary);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  try {
    await openReview();
    await chooseTask("review");
    await submit("Prüfung mit einer langen Antwort.", 0);
    await streamProviderText(0, "Ein langer Abschnitt zum kontrollierten Prüfen.\n\n".repeat(180));
    await expect(activeLog()).toHaveText(expect.stringContaining("kontrollierten Prüfen"));
    const cancel = inside("stop-response");
    const reachable = await browser.execute(() => {
      const button = document.querySelector("[data-testid=stop-response]");
      const log = document.querySelector(".pe-copilot-log");
      const bounds = button?.getBoundingClientRect();
      return Boolean(
        log &&
        log.scrollHeight > log.clientHeight &&
        bounds &&
        bounds.top >= 0 &&
        bounds.bottom <= innerHeight,
      );
    });
    expect(reachable).toBe(true);
    await cancel.click();
    await expect(cancel).toBeFocused();
    await browser.waitUntil(async () => (await readProviderCalls())[0]?.aborted === true);
    await finishProviderCall(0, "VERALTET-NACH-ABBRUCH");
    await expect(activeLog()).not.toHaveText(expect.stringContaining("VERALTET-NACH-ABBRUCH"));

    await submit("Antwort ist leer.", 1);
    await finishProviderCall(1, "");
    await expect(panel().$("[role=alert]")).toHaveText(
      expect.stringContaining("unlesbare Antwort"),
    );
    await expect(inside("copilot-prompt")).toHaveValue("Antwort ist leer.");
    await chooseTask("draft");
    await submit("Antwort ist kein gültiger Vorschlag.", 2);
    await finishProviderCall(2, "{}");
    await expect(panel().$("[role=alert]")).toHaveText(
      expect.stringContaining("Vorschlag konnte nicht geprüft werden"),
    );
    await expect(inside("copilot-proposal")).not.toExist();
    await chooseTask("review");
    await submit("Prüfung explizit wiederholen.", 3);
    await finishProviderCall(3, "Die kontrollierte Wiederholung war erfolgreich.");
    await expect(activeLog()).toHaveText(expect.stringContaining("Wiederholung war erfolgreich"));
    expect(await readProviderCalls()).toHaveLength(4);
    await browser.keys("Escape");
  } finally {
    await browser.sendCommandAndGetResult("Emulation.clearDeviceMetricsOverride", {});
  }
});
