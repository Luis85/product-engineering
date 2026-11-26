import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import {
  backlogBoardRoute,
  backlogRoute,
  nfrCatalogRoute,
  pbiDetailRoute,
} from "../../../src/application/backlog";
import { prototypesRoute } from "../../../src/application/prototypes";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminFolder, adminProject, customerFolder, customerProject } from "../knowledge-vault";
import {
  legacyPrototypePath,
  legacyPrototypeTitle,
  prototypeChildPath,
  prototypeFolder,
  prototypeNfrId,
  prototypeNfrPath,
  prototypeNfrTitle,
  seedPrototypesVault,
} from "../prototype-vault";
import { fields } from "../story-map-handoff";
import { customerMapId } from "../story-maps-vault";
import { openView, readVaultText, readViewRoute, ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const form = () => el("prototype-form");
const scope = () => form().$("select[name=scope]");
const detail = () => el("prototype-detail");
const links = () => el("prototype-source-links");
const row = (id: string) => browser.$(`${ROOT} [data-prototype-row="${id}"]`);
const notes = (folder: string) =>
  browser.executeObsidian(
    ({ app }, prefix) =>
      app.vault
        .getMarkdownFiles()
        .map(({ path }) => path)
        .filter((path) => path.startsWith(prefix + "/")),
    folder,
  );

async function brief(title: string, description: string, source?: string) {
  if (source) await scope().selectByAttribute("value", source);
  await form().$("input[name=title]").setValue(title);
  await form().$("textarea[name=description]").setValue(description);
}

async function mapLinks() {
  const disclosure = el("story-map-context-prototypes");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(links()).toBeDisplayed();
}

async function includeDesign(kind: "style-guide" | "design-system", title: string, body: string) {
  await el("prototype-draft-" + kind).click();
  const document = browser.$(
    `${ROOT} [role=dialog][data-state=open] form:has(textarea[name=body])`,
  );
  await document.$("input[name=title]").setValue(title);
  await document.$("textarea[name=body]").setValue(body);
  await document.$("button[type=submit]").click();
  await expect(document).not.toExist();
  const selection = form().$(`select[name=${kind}]`);
  await expect(selection.$("option:checked")).toHaveText(expect.stringContaining(title));
  return selection.getValue();
}

before(async () => {
  await seedPrototypesVault();
  await openView();
});

it("creates a persisted prototype from the SM-01 disclosure", async () => {
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await el("story-map-context-prototypes").click();
  await expect(el("prototype-create")).toBeDisplayed();
  await el("prototype-create").click();
  await expect(scope()).toHaveValue(`map:${customerMapId}`);
  await brief("Übergabeablauf erkunden", "Den Export nach der Vorschau bestätigen.");
  await el("prototype-save").click();
  await expect(el("prototype-detail")).toHaveText(
    expect.stringContaining("Den Export nach der Vorschau bestätigen."),
  );
});

it("creates a persisted prototype from the TASK-05 editor", async () => {
  await setViewRoute(backlogRoute(customerProject, "TASK-05"));
  await expect(el("backlog-form")).toBeDisplayed();
  await expect(el("prototype-create")).toBeDisplayed();
  await el("prototype-create").click();
  await expect(scope()).toHaveValue("TASK:TASK-05");
  await brief("CSV-Testdaten prüfen", "Einen Testfall für den Export auswählen.");
  await el("prototype-save").click();
  await expect(el("prototype-detail")).toHaveText(
    expect.stringContaining("Einen Testfall für den Export auswählen."),
  );
});

it("creates a persisted prototype from the project Planning register", async () => {
  await setViewRoute(backlogRoute(customerProject));
  const rail = el("project-rail");
  const entry = rail.$("button=Prototypen");
  await expect(entry).toBeDisplayed();
  await entry.click();
  const register = el("prototype-register");
  const legacy = register.$("[data-prototype-row=PT-03]");
  await expect(legacy).toHaveText(expect.stringContaining("PT-03 · Revision 2"));
  await expect(legacy).toHaveText(expect.stringContaining("Gefilterte Servicefälle exportieren"));
  await expect(legacy).toHaveText(expect.stringContaining("Klickbar"));
  await register.$("[data-testid=prototype-create]").click();
  await expect(scope()).toHaveValue("");
  await el("prototype-save").click();
  await expect(scope()).toHaveAttribute("aria-invalid", "true");
  await brief(
    "CSV-Übergabe erproben",
    "Einen Fall aus der gefilterten Tabelle exportieren.",
    "UC:UC-09",
  );
  await el("prototype-save").click();
  await expect(el("prototype-detail")).toHaveText(
    expect.stringContaining("Einen Fall aus der gefilterten Tabelle exportieren."),
  );
});

it("keeps PT-03 read-only on open and moves just one of two UC-09 backlinks on edit", async () => {
  const legacyBytes = await readVaultText(legacyPrototypePath);
  const adminPath = `${adminFolder}/Admin-Prototyp.md`;
  const adminBytes = await readVaultText(adminPath);
  await setViewRoute(pbiDetailRoute(customerProject, "UC-09"));
  await expect(links().$("[data-prototype-link=PT-03]")).toHaveText(
    expect.stringContaining("Klickbar"),
  );
  await links().$(`button=${legacyPrototypeTitle}`).click();
  await expect(detail()).toHaveText(expect.stringContaining(legacyPrototypeTitle));
  await expect(detail()).toHaveText(expect.stringContaining("Gefilterte Servicefälle exportieren"));
  await expect(detail().$("[data-testid=prototype-scope] button")).toBeDisplayed();
  await detail().$("[data-testid=prototype-scope] button").click();
  await expect(links().$(`button=${legacyPrototypeTitle}`)).toBeFocused();

  const keep = "CSV im Portal belassen";
  const move = "Übergabe zur Story Map wechseln";
  for (const title of [keep, move]) {
    await links().$("[data-testid=prototype-create]").click();
    await expect(scope()).toHaveValue("UC:UC-09");
    await brief(title, "Den gewählten Ablauf nachvollziehen.");
    await el("prototype-save").click();
    await expect(detail().$("h1")).toHaveText(title);
    if (title === keep) await detail().$("[data-testid=prototype-scope] button").click();
  }
  const movingId = await detail().getAttribute("data-prototype-id");
  if (!movingId) throw new Error("Prototype has no display ID");
  const movingPath = (await notes(prototypeFolder)).find((path) => path.includes(movingId));
  if (!movingPath) throw new Error("Saved brief is missing");
  await el("prototype-edit").click();
  await expect(scope()).toHaveValue("UC:UC-09");
  await browser.executeObsidian(async ({ app }, path) => {
    const note = app.vault.getFileByPath(path);
    if (!note) throw new Error("Missing native note");
    await app.vault.process(
      note,
      (text) => `${text}\n## Outside annotation\n\nKeep the original evidence.\n`,
    );
  }, movingPath);
  await scope().selectByAttribute("value", `map:${customerMapId}`);
  await el("prototype-save").click();
  await expect(detail()).toHaveText(expect.stringContaining(`${movingId} · Revision 2`));
  expect(await readVaultText(movingPath)).toContain(
    "## Outside annotation\n\nKeep the original evidence.",
  );
  await setViewRoute(pbiDetailRoute(customerProject, "UC-09"));
  await expect(links().$(`button=${move}`)).not.toExist();
  await expect(links().$(`button=${keep}`)).toBeDisplayed();
  await expect(links().$(`button=${legacyPrototypeTitle}`)).toBeDisplayed();
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await mapLinks();
  await expect(links().$(`button=${move}`)).toBeDisplayed();
  await expect(links().$(`button=${keep}`)).not.toExist();
  await links().$(`button=${move}`).click();
  await detail().$("[data-testid=prototype-scope] button").click();
  await expect(links().$(`button=${move}`)).toBeFocused();
  await setViewRoute(prototypesRoute(adminProject));
  await expect(row("PT-03")).toHaveText(expect.stringContaining("Vertretungszugriff exportieren"));
  await expect(row("PT-03")).toHaveText(expect.stringContaining("Admin service"));
  await row("PT-03").$("button=Admin service").click();
  await expect(el("backlog-form").$("input[name=title]")).toHaveValue("Admin service");
  expect(await readVaultText(adminPath)).toBe(adminBytes);
  expect(await readVaultText(legacyPrototypePath)).toBe(legacyBytes);
});

it("retries after a native brief write refusal with exactly one of each authored design, then reuses both after restart", async () => {
  const title = "CSV-Übergabe mit Gestaltung";
  const styleTitle = "Gestaltung im Kundenportal";
  const systemTitle = "Komponenten für den Service";
  const styleBody = "Primärfarbe #245b61 und gut lesbare Schrift.";
  const systemBody = "Schaltflächen zeigen einen sichtbaren Fokus.";
  const prior = await notes(prototypeFolder);
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await mapLinks();
  await links().$("[data-testid=prototype-create]").click();
  await brief(title, "Die benannten Zustände und die CSV-Auswahl ausprobieren.");
  const style = await includeDesign("style-guide", styleTitle, styleBody);
  const system = await includeDesign("design-system", systemTitle, systemBody);
  await browser.executeObsidian(({ app }, folder) => {
    const create = app.vault.create.bind(app.vault);
    app.vault.create = async (path, ...args) => {
      if (path.startsWith(folder + "/")) {
        app.vault.create = create;
        throw new Error("Controlled native prototype write refusal");
      }
      return create(path, ...args);
    };
  }, prototypeFolder);
  await el("prototype-save").click();
  await expect(form().$("[role=alert]")).toBeDisplayed();
  await expect(form().$("input[name=title]")).toHaveValue(title);
  expect(await notes(prototypeFolder)).toEqual(prior);
  const designNotes = (paths: readonly string[]) =>
    paths
      .filter((path) => path.endsWith(`/${styleTitle}.md`) || path.endsWith(`/${systemTitle}.md`))
      .toSorted();
  const designs = designNotes(await notes(customerFolder));
  expect(designs).toHaveLength(2);
  const stylePath = designs.find((path) => path.endsWith(`/${styleTitle}.md`));
  const systemPath = designs.find((path) => path.endsWith(`/${systemTitle}.md`));
  if (!stylePath || !systemPath) throw new Error("Missing authored design notes");
  const styleBefore = (await readVaultText(stylePath)) ?? "";
  const systemBefore = (await readVaultText(systemPath)) ?? "";
  expect(styleBefore).toContain(styleBody);
  expect(systemBefore).toContain(systemBody);
  expect(fields(styleBefore)).toMatchObject({
    kind: "style-guide",
    id: style,
    project_id: customerProject,
  });
  expect(fields(systemBefore)).toMatchObject({
    kind: "design-system",
    id: system,
    project_id: customerProject,
  });
  await browser.executeObsidian(async ({ app }, path) => {
    const note = app.vault.getFileByPath(path);
    if (!note) throw new Error("Missing styled design note");
    await app.vault.process(note, (text) => `${text}\nDie Typografie wurde extern geprüft.\n`);
  }, stylePath);
  const styleEdited = await readVaultText(stylePath);
  await el("prototype-save").click();
  await expect(detail().$("h1")).toHaveText(title);
  const route = await readViewRoute();
  const written = (await notes(prototypeFolder)).filter((path) => !prior.includes(path));
  expect(written).toHaveLength(1);
  expect(fields((await readVaultText(written[0] ?? "")) ?? "")).toMatchObject({
    revision: 1,
    source_kind: "map",
    source_id: customerMapId,
    source_project_id: customerProject,
    style_guide_id: style,
    design_system_id: system,
  });
  expect(designNotes(await notes(customerFolder))).toEqual(designs);
  expect(await readVaultText(stylePath)).toBe(styleEdited);
  expect(await readVaultText(systemPath)).toBe(systemBefore);
  await browser.reloadObsidian();
  await openView();
  await setViewRoute(route);
  await expect(detail().$("h1")).toHaveText(title);
  await expect(detail()).toHaveText(expect.stringContaining(styleTitle));
  await expect(detail()).toHaveText(expect.stringContaining(systemTitle));
  await setViewRoute(prototypesRoute(customerProject));
  await el("prototype-create").click();
  await brief(
    "Wiederverwendbare Gestaltung",
    "Den Export mit den vorhandenen Notizen prüfen.",
    "UC:UC-09",
  );
  await form().$("select[name=style-guide]").selectByAttribute("value", style);
  await form().$("select[name=design-system]").selectByAttribute("value", system);
  await el("prototype-save").click();
  await expect(detail()).toHaveText(expect.stringContaining(styleTitle));
  expect(await notes(prototypeFolder)).toHaveLength(prior.length + 2);
  expect(designNotes(await notes(customerFolder))).toEqual(designs);
});

it("keeps a dirty 390px Task editor, uses the grouped keyboard picker and cancels both drafts without writes", async () => {
  await setViewRoute(backlogRoute(customerProject, "TASK-05"));
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  const editor = el("backlog-form");
  const title = editor.$("input[name=title]");
  const taskBytes = await readVaultText(prototypeChildPath);
  const files = await notes(customerFolder);
  await title.setValue("Ungespeicherter Testdaten-Titel");
  const origin = links().$("[data-testid=prototype-create]");
  await browser.execute((control: HTMLElement) => control.focus(), await origin);
  await browser.keys("Enter");
  await expect(scope()).toHaveValue("TASK:TASK-05");
  for (const kind of [
    "Epic",
    "Feature",
    "PBI",
    "Task",
    "Issue",
    "Frage",
    "Bug",
    "Story Map",
    "NFR",
  ]) {
    await expect(scope().$(`optgroup[label="${kind}"] option:first-child`)).toExist({ wait: 5000 });
  }
  await browser.execute((control: HTMLElement) => control.focus(), await scope());
  await browser.keys("End");
  await expect(scope()).toHaveValue(`nfr:${prototypeNfrId}`);
  const geometry = await browser.execute(
    (control: HTMLElement) => {
      const dialog = control.closest<HTMLElement>("[role=dialog]");
      const leaf = control.closest<HTMLElement>(".workspace-leaf");
      const owner = leaf?.getBoundingClientRect();
      const rect = dialog?.getBoundingClientRect();
      return {
        width: owner?.width,
        contained: Boolean(owner && rect && rect.left >= owner.left && rect.right <= owner.right),
        overflow: dialog ? dialog.scrollWidth - dialog.clientWidth : -1,
      };
    },
    await scope(),
  );
  expect(geometry).toEqual({ width: 390, contained: true, overflow: 0 });
  await includeDesign("style-guide", "Verworfener Stil", "Diese Notiz bleibt ein Entwurf.");
  await browser.keys("Escape");
  await expect(form()).not.toExist();
  await expect(origin).toBeFocused();
  await expect(title).toHaveValue("Ungespeicherter Testdaten-Titel");
  expect(await readVaultText(prototypeChildPath)).toBe(taskBytes);
  expect(await notes(customerFolder)).toEqual(files);
  await el("backlog-cancel").click();
});

it("offers native NFR and Board scope actions and preserves a draft when its NFR disappears", async () => {
  await setViewRoute(backlogBoardRoute(customerProject));
  const card = browser.$(`${ROOT} [data-board-card=UC-09]`);
  const actions = card.$("details.pe-board-actions");
  await actions.$("summary").click();
  const createFromBoard = card.$("[data-testid=prototype-create]");
  await createFromBoard.click();
  await expect(scope()).toHaveValue("UC:UC-09");
  await el("prototype-cancel").click();
  await expect(createFromBoard).toBeFocused();
  await setViewRoute(nfrCatalogRoute(customerProject));
  const nfrRow = browser.$(
    `${ROOT} li.pe-nfr-row:has([data-pe-focus-key='nfr-${prototypeNfrId}'])`,
  );
  await nfrRow.$("[data-testid=prototype-create-compact]").click();
  await expect(scope()).toHaveValue(`nfr:${prototypeNfrId}`);
  await el("prototype-cancel").click();
  await nfrRow.$("[data-testid=nfr-row-open]").click();
  await links().$("[data-testid=prototype-create]").click();
  await brief("Export-Isolation prüfen", "Eine fremde Organisation bei der Suche ausschließen.");
  await el("prototype-save").click();
  await expect(detail()).toHaveText(expect.stringContaining(prototypeNfrTitle));
  const savedRoute = await readViewRoute();
  await setViewRoute(prototypesRoute(customerProject));
  const count = await notes(prototypeFolder);
  await el("prototype-create").click();
  await brief(
    "Entwurf nach Löschung",
    "Die Arbeit bleibt beim Beheben des Bezugs erhalten.",
    `nfr:${prototypeNfrId}`,
  );
  await browser.executeObsidian(async ({ app }, path) => {
    const target = app.vault.getFileByPath(path);
    if (!target) throw new Error("Missing NFR to delete");
    await app.vault.trash(target, true);
  }, prototypeNfrPath);
  await el("prototype-save").click();
  await expect(scope()).toBeFocused();
  await expect(form().$("[role=alert]")).toHaveText(
    "Wähle einen verfügbaren Bezug aus diesem Projekt.",
  );
  await expect(form().$("input[name=title]")).toHaveValue("Entwurf nach Löschung");
  expect(await notes(prototypeFolder)).toEqual(count);
  await el("prototype-cancel").click();
  await setViewRoute(savedRoute);
  await expect(detail()).toHaveText(expect.stringContaining("Bezug nicht verfügbar"));
});
