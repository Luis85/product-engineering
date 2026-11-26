import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { Buffer } from "node:buffer";
import { knowledgeDetailRoute, projectKnowledgeRoute } from "../../../src/application/knowledge";
import { catalogFor } from "../../../src/application/messages";
import { projectOverviewRoute } from "../../../src/application/projects";
import { splitNoteText } from "../../../src/domain/notes";
import {
  guide,
  image,
  jobPath,
  jobTitle,
  narrowKnowledgeLeaf,
  protectedLine,
  seedKnowledgeDetailVault,
} from "../knowledge-detail-vault";
import {
  adminProject,
  customerFolder,
  customerProject,
  jobOne,
  jobTwo,
  vision,
} from "../knowledge-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
  VIEW_TYPE,
} from "../support";

const messages = catalogFor(TEST_LANGUAGE);
const note = messages.knowledge.note;
const button = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const editor = () => browser.$(`${ROOT} textarea[name=markdown]`);
const modal = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const relation = (id: string) =>
  browser.$(`${ROOT} [data-knowledge-relation=${JSON.stringify(id)}]`);
const content = () => button("knowledge-body");

before(seedKnowledgeDetailVault);

async function openJob() {
  await openView();
  await setViewRoute(projectKnowledgeRoute(customerProject));
  await browser.$(`${ROOT} [data-knowledge-record="${jobOne}"]`).click();
  await expect(button("knowledge-note").$("h1")).toHaveText(jobTitle);
}

async function file(id: string) {
  const raw = await readVaultText(`${customerFolder}/${id}.md`);
  if (raw === null) throw new Error("Missing fixture note " + id);
  return raw;
}

async function editBody() {
  await button("knowledge-edit").click();
  await expect(editor()).toBeFocused();
}

async function selectFile(path: string) {
  const dialog = modal();
  await dialog.$("input[type=search]").setValue(path);
  await dialog.$(`[data-vault-file=${JSON.stringify(path)}]`).click();
  return dialog;
}

async function confirmFile() {
  await modal().$("[data-testid=knowledge-vault-confirm]").click();
  await expect(modal()).not.toBeDisplayed();
}

async function expectExactExport(expected: string) {
  await browser.execute(() => {
    const readUrl = URL.createObjectURL.bind(URL);
    const previousUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const previousClick = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "click");
    URL.createObjectURL = (resource) => {
      if (resource instanceof Blob) {
        void resource.arrayBuffer().then((buffer) => {
          const bytes = new Uint8Array(buffer);
          document.body.dataset.v04Export = btoa(
            Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
          );
        });
      }
      return readUrl(resource);
    };
    HTMLAnchorElement.prototype.click = function () {
      if (previousUrl) Object.defineProperty(URL, "createObjectURL", previousUrl);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (previousClick) Object.defineProperty(HTMLAnchorElement.prototype, "click", previousClick);
      else Reflect.deleteProperty(HTMLAnchorElement.prototype, "click");
      document.body.dataset.v04ExportName = this.download;
    };
  });
  await button("knowledge-note-actions").click();
  await button("knowledge-export").click();
  await browser.waitUntil(() => browser.execute(() => Boolean(document.body.dataset.v04Export)));
  const captured = await browser.execute(() => {
    const name = document.body.dataset.v04ExportName;
    const bytes = document.body.dataset.v04Export;
    delete document.body.dataset.v04Export;
    delete document.body.dataset.v04ExportName;
    return { name, bytes };
  });
  expect(captured).toEqual({
    name: "JOB-12.md",
    bytes: Buffer.from(expected, "utf8").toString("base64"),
  });
}

it("renders Markdown without loading active HTML or remote image sources from the note", async () => {
  await openJob();
  await editBody();
  const markdown =
    '## Sichere Vorschau\n\n<img src="http://127.0.0.1:1/raw.png">\n\n![Remote](http://127.0.0.1:1/image.png)\n\n`<img src=example>`\n';
  await editor().setValue(markdown);
  await button("knowledge-save").click();
  await expect(button("knowledge-note")).toHaveText(expect.stringContaining(note.saved));
  await button("knowledge-content-tab").click();
  await expect(content().$("h2")).toHaveText("Sichere Vorschau");
  await expect(content().$("code")).toHaveText("<img src=example>");
  await expect(content().$$("img")).toBeElementsArrayOfSize(0);
  expect(splitNoteText(await file("JOB-12")).body.replaceAll("\r\n", "\n")).toBe(markdown);
});

async function fromJob(kind: "research" | "prd", title: string, multiple = false) {
  await button("knowledge-create-" + kind).click();
  const dialog = modal();
  await expect(dialog).toHaveText(expect.stringContaining(jobTitle));
  await dialog.$("input[name=title]").setValue(title);
  if (kind === "prd") {
    await expect(dialog.$(`input[value="${jobOne}"]`)).toBeSelected();
    const visionChoice = dialog.$("select[name=vision_id]");
    await expect(visionChoice).toHaveValue(vision);
    if (multiple) {
      await dialog.$(`input[value="${jobTwo}"]`).click();
      await visionChoice.selectByAttribute("value", "");
      await visionChoice.selectByAttribute("value", vision);
    }
  }
  await dialog.$("button[type=submit]").click();
  await expect(editor()).toBeFocused();
  const raw = await file(title);
  const match = /^id: (knowledge-[\da-f-]+)$/m.exec(raw)?.[1];
  if (!match) throw new Error("Derived note missing identity");
  return match;
}

it("derives research and two requirements and restores both sides from a reloaded Vault", async () => {
  await openJob();
  const research = await fromJob("research", "Übergabe erforschen");
  await editor().setValue("## Interviews\n\nMara bestätigt die Übergabe.");
  await button("knowledge-save").click();
  await expect(button("knowledge-note")).toHaveText(expect.stringContaining(note.saved));
  await relation(jobOne).click();
  await expect(relation(research)).toBeDisplayed();

  const first = await fromJob("prd", "Übergabe absichern", true);
  await expect(relation(jobTwo)).toBeDisplayed();
  await expect(relation(vision)).toBeDisplayed();
  await relation(jobOne).click();
  const second = await fromJob("prd", "Vertretung absichern");
  await relation(jobOne).click();
  await expect(relation(first)).toBeDisplayed();
  await expect(relation(second)).toBeDisplayed();

  await button("knowledge-create-prd").click();
  await modal().$("input[name=title]").setValue("Verworfene Anforderung");
  await browser.keys("Escape");
  await expect(button("knowledge-create-prd")).toBeFocused();
  expect(await readVaultText(customerFolder + "/Verworfene Anforderung.md")).toBeNull();
  await button("knowledge-create-prd").click();
  await modal().$("input[name=title]").setValue("Alte Projektauswahl");
  await setViewRoute(projectOverviewRoute(adminProject));
  await expect(modal()).not.toBeDisplayed();
  expect(await readVaultText(customerFolder + "/Alte Projektauswahl.md")).toBeNull();

  await reloadPlugin();
  await openJob();
  for (const id of [research, first, second]) {
    await relation(id).click();
    await expect(relation(jobOne)).toBeDisplayed();
    await relation(jobOne).click();
  }
  expect(await file("Übergabe erforschen")).toContain("Mara bestätigt die Übergabe.");
  const prd = await file("Übergabe absichern");
  expect(prd).toContain("vision_id: " + vision);
  expect(prd).toContain(jobTwo);
  const pbiCount = await browser.executeObsidian(
    ({ app }) =>
      app.vault
        .getMarkdownFiles()
        .filter((entry) => app.metadataCache.getFileCache(entry)?.frontmatter?.kind === "pbi")
        .length,
  );
  expect(pbiCount).toBe(0);
});

it("uses native Markdown resolution and preserves separate references, aliases and embeds on disk", async () => {
  await openJob();
  await editBody();
  await editor().setValue("Read selected text next.\n");
  await browser.execute(
    (selector) => document.querySelector<HTMLTextAreaElement>(selector)?.setSelectionRange(5, 18),
    `${ROOT} textarea[name=markdown]`,
  );
  await button("knowledge-insert-link").click();
  const link = await selectFile(guide);
  await expect(link.$("input[name=vault-alias]")).toHaveValue("selected text");
  await link.$("select[name=vault-heading]").selectByAttribute("value", "#Fundstelle");
  await confirmFile();
  await expect(editor()).toBeFocused();
  const withLink = await editor().getValue();
  expect(withLink).toContain("Fundstelle|selected text");
  await editor().setValue(withLink + "\n[[PRD-03#Problem|Anforderung]] [[Unbekanntes Ziel]]\n");
  await browser.execute((selector) => {
    const control = document.querySelector<HTMLTextAreaElement>(selector);
    if (control) control.setSelectionRange(control.value.length, control.value.length);
  }, `${ROOT} textarea[name=markdown]`);
  await button("knowledge-insert-image").click();
  await selectFile(image);
  await confirmFile();
  await expect(editor()).toHaveValue(expect.stringContaining("![["));
  await button("knowledge-save").click();
  await expect(button("knowledge-note")).toHaveText(expect.stringContaining(note.saved));
  const saved = await file("JOB-12");
  expect(saved).toContain(protectedLine + "\r\n");
  expect(saved).toContain("approval: approved # Fachentscheidung\r\n");
  expect(splitNoteText(saved).body).toContain("[[PRD-03#Problem|Anforderung]]");
  await button("knowledge-content-tab").click();
  await expect(content().$("a.internal-link=selected text")).toHaveAttribute(
    "data-href",
    expect.stringContaining("Fundstelle"),
  );
  await expect(content().$("img")).toBeDisplayed();
  await expect(content().$("a.internal-link=Unbekanntes Ziel")).toBeDisplayed();

  await button("knowledge-references-tab").click();
  await expect(button("knowledge-inline-links")).toHaveText(expect.stringContaining("Anforderung"));
  await expect(button("knowledge-explicit-references").$$("li")).toBeElementsArrayOfSize(0);
  await button("knowledge-add-reference").click();
  await selectFile("Quellen/B/Unsicher.html");
  await expect(modal().$("[data-testid=knowledge-vault-confirm]")).toBeDisabled();
  await selectFile(guide);
  await confirmFile();
  await button("knowledge-save").click();
  await expect(button("knowledge-explicit-references").$$("li")).toBeElementsArrayOfSize(1);
  await button("knowledge-add-reference").click();
  await selectFile(guide);
  await confirmFile();
  await expect(button("knowledge-explicit-references")).toHaveText(
    expect.stringContaining(note.duplicateReference),
  );
  const withReference = await file("JOB-12");
  expect(splitNoteText(withReference).body).toBe(splitNoteText(saved).body);
  expect(withReference).toContain("references:");
  await reloadPlugin();
  await openJob();
  await button("knowledge-references-tab").click();
  await expect(button("knowledge-explicit-references").$$("li")).toBeElementsArrayOfSize(1);
  await button("knowledge-explicit-references").$("li button:first-child").click();
  await browser.waitUntil(async () =>
    browser.executeObsidian(({ app }, path) => app.workspace.getActiveFile()?.path === path, guide),
  );
});

it("keeps a dirty draft through Back and a conflicting save and reloads the latest file on request", async () => {
  await openJob();
  await editBody();
  await editor().setValue("Mein lokaler Entwurf");
  const back = () =>
    browser.$(
      `${ROOT} [data-testid=frame-history] button[aria-label=${JSON.stringify(messages.shell.frame.back)}]`,
    );
  await back().click();
  await modal().$("[data-testid=knowledge-keep-editing]").click();
  await expect(editor()).toBeFocused();
  await editor().addValue(" und weitere Eingabe");
  await relation(vision).click();
  await modal().$("[data-testid=knowledge-keep-editing]").click();
  await expect(editor()).toBeFocused();
  const switcher = browser.$(
    `${ROOT} [data-testid=project-rail] [data-pe-focus-key=project-picker]`,
  );
  if (await switcher.isDisplayed()) {
    await switcher.click();
  } else {
    await browser
      .$(`${ROOT} button[aria-label=${JSON.stringify(messages.projects.openNavigation)}]`)
      .click();
    await modal().$("[data-pe-focus-key=project-picker]").click();
  }
  await modal().$('button[aria-label="Admin Console"]').click();
  await expect(browser.$$(`${ROOT} [role=dialog][data-state=open]`)).toBeElementsArrayOfSize(1);
  await modal().$("[data-testid=knowledge-keep-editing]").click();
  await expect(editor()).toBeFocused();
  await browser.executeObsidian(async ({ app }, path) => {
    const job = app.vault.getFileByPath(path);
    if (!job) throw new Error("Missing job");
    await app.vault.process(job, (raw) => raw + "\r\nAußerhalb gespeichert.\r\n");
  }, jobPath);
  await expect(button("knowledge-conflict")).toBeDisplayed();
  await back().click();
  await modal().$("[data-testid=knowledge-save-leave]").click();
  await expect(editor()).toBeFocused();
  await expect(editor()).toHaveValue("Mein lokaler Entwurf und weitere Eingabe");
  expect(await readViewRoute()).toMatchObject(knowledgeDetailRoute(customerProject, jobOne));
  await expectExactExport(await file("JOB-12"));
  await expect(editor()).toHaveValue("Mein lokaler Entwurf und weitere Eingabe");
  await button("knowledge-reload").click();
  await expect(editor()).toHaveValue(expect.stringContaining("Außerhalb gespeichert."));
  await editor().setValue("Nur verwerfen");
  await back().click();
  await modal().$("[data-testid=knowledge-discard-leave]").click();
  await expect(button("knowledge-library")).toBeDisplayed();
  expect(await file("JOB-12")).not.toContain("Nur verwerfen");
});

it("restores PRD ableiten after returning to the source Vision", async () => {
  await openJob();
  await relation(vision).click();
  await expect(button("knowledge-note-header").$("h1")).toHaveText("Produktvision Kundenportal");
  const derive = button("knowledge-create-prd");
  await expect(derive).toBeDisplayed();
  const origin = await readViewRoute();
  const returns = [
    button("project-record-return"),
    browser.$(
      `${ROOT} [data-testid=frame-history] button[aria-label=${JSON.stringify(messages.shell.frame.back)}]`,
    ),
  ];
  for (const [index, back] of returns.entries()) {
    await derive.click();
    await modal()
      .$("input[name=title]")
      .setValue("Vision Anforderung " + index);
    await modal().$("button[type=submit]").click();
    await expect(editor()).toBeFocused();
    await back.click();
    await expect(button("knowledge-note-header").$("h1")).toHaveText("Produktvision Kundenportal");
    expect(await readViewRoute()).toEqual(origin);
    await expect(derive).toBeFocused();
  }
});

async function noteGeometry(popout: boolean) {
  return browser.executeObsidian(
    ({ app }, type, scope, moved) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      const owner = leaf?.view.containerEl.ownerDocument;
      const pane = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
      const root = leaf?.view.containerEl.querySelector<HTMLElement>(scope);
      const header = root?.querySelector<HTMLElement>("[data-testid=knowledge-note-header]");
      const title = header?.querySelector<HTMLElement>("h1");
      const trigger = header?.querySelector<HTMLButtonElement>(
        "[data-testid=knowledge-note-actions]",
      );
      const edit = header?.querySelector<HTMLButtonElement>("[data-testid=knowledge-edit]");
      if (!owner || !pane || !root || !title || !trigger || !edit) return;
      if ((owner !== document) !== moved) return;
      const outer = pane.getBoundingClientRect();
      const controls = [
        title,
        trigger,
        edit,
        ...root.querySelectorAll<HTMLElement>("[data-testid=knowledge-action-panel]"),
      ];
      return {
        width: outer.width,
        titleWraps: title.scrollWidth <= title.clientWidth,
        inside: controls.every((control) => {
          const rectangle = control.getBoundingClientRect();
          return rectangle.left >= outer.left - 1 && rectangle.right <= outer.right + 1;
        }),
        menu: trigger.getAttribute("aria-expanded"),
      };
    },
    VIEW_TYPE,
    ROOT,
    popout,
  );
}

it("keeps the title and keyboard-accessible actions inside a 390px split and pop-out leaf", async () => {
  await reloadPlugin();
  await openView();
  await setViewRoute(knowledgeDetailRoute(customerProject, jobOne));
  await expect(button("knowledge-note-header").$("h1")).toHaveText(jobTitle);
  await narrowKnowledgeLeaf();
  const actions = button("knowledge-note-actions");
  await actions.click();
  await expect(button("knowledge-export")).toBeFocused();
  expect(await noteGeometry(false)).toEqual({
    width: 390,
    titleWraps: true,
    inside: true,
    menu: "true",
  });
  await browser.keys("Escape");
  await expect(actions).toBeFocused();
  await browser.executeObsidian(({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    if (!leaf) throw new Error("Missing split leaf");
    app.workspace.moveLeafToPopout(leaf);
  }, VIEW_TYPE);
  try {
    await browser.waitUntil(async () => Boolean(await noteGeometry(true)));
    await browser.executeObsidian(({ app }, type) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      const pane = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
      if (!leaf || !pane) throw new Error("Missing pop-out leaf");
      pane.style.flex = "0 0 390px";
      pane.style.width = "390px";
      leaf.view.containerEl
        .querySelector<HTMLButtonElement>("[data-testid=knowledge-note-actions]")
        ?.click();
    }, VIEW_TYPE);
    expect(await noteGeometry(true)).toEqual({
      width: 390,
      titleWraps: true,
      inside: true,
      menu: "true",
    });
  } finally {
    await browser.executeObsidian(({ app }, type) => {
      app.workspace
        .getLeavesOfType(type)
        .find(({ view }) => view.containerEl.ownerDocument !== document)
        ?.detach();
    }, VIEW_TYPE);
  }
});
