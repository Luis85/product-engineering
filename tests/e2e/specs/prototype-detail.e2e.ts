import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { pbiDetailRoute } from "../../../src/application/backlog";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { newNoteText } from "../../../src/domain/notes";
import { isPrototypeId } from "../../../src/domain/prototypes";
import { work } from "../backlog-vault";
import {
  adminFolder,
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
} from "../knowledge-vault";
import { capturePrototypeDownload } from "../prototype-native";
import { prototypeNfrPath, seedPrototypesVault } from "../prototype-vault";
import { customerMapId, matchedMapPath } from "../story-maps-vault";
import { openView, readViewRoute, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const scopeEntity = "knowledge-33333333-3333-4333-8333-000000000621";
const neighbor = "knowledge-33333333-3333-4333-8333-000000000622";
const style = "knowledge-33333333-3333-4333-8333-000000000623";
const system = "knowledge-33333333-3333-4333-8333-000000000624";
const styleBody = "Farben für die Exportsteuerung mit geprüftem Kontrast.";
const systemBody = "Primäre Schaltfläche zeigt einen sichtbaren Fokus.";

before(async () => {
  await seedPrototypesVault();
  const entities = [
    {
      id: scopeEntity,
      title: "Übergabeauftrag",
      display_id: "ENT-61",
      domain_scope: [{ kind: "prd", id: customerRequirement }],
      domain_attributes: [{ name: "Fallnummer", description: "Eindeutige Referenz des Falls" }],
      domain_edges: [
        {
          id: "REL-61",
          target: neighbor,
          verb: "umfasst",
          sourceCardinality: "1",
          targetCardinality: "0..*",
          rule: "Nur Fälle der gewählten Organisation.",
        },
      ],
    },
    { id: neighbor, title: "Servicefenster", display_id: "ENT-62" },
  ].map(({ title, ...fields }) => ({
    path: `${customerFolder}/${title}.md`,
    raw: newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        kind: "entity",
        project_id: customerProject,
        title,
        ...fields,
      },
      "Definition für die prüfbare Übergabe.",
    ),
  }));
  const design = [
    {
      id: style,
      kind: "style-guide",
      display_id: "SG-61",
      title: "Typografie im Portal",
      body: styleBody,
    },
    {
      id: system,
      kind: "design-system",
      display_id: "DS-61",
      title: "Bedienelemente im Portal",
      body: systemBody,
    },
  ].map(({ body, ...fields }) => ({
    path: `${customerFolder}/${fields.title}.md`,
    raw: newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        project_id: customerProject,
        ...fields,
      },
      body,
    ),
  }));
  await browser.executeObsidian(
    async ({ app }, notes) => {
      for (const { path, raw } of notes) await app.vault.create(path, raw);
    },
    [...entities, ...design],
  );
  await openView();
});

async function captureDownload(id: string) {
  return capturePrototypeDownload(await el(id));
}

async function createMapBrief(title: string, withDesign = false) {
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  const disclosure = el("story-map-context-prototypes");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await el("prototype-create").click();
  const form = el("prototype-form");
  await expect(form.$("select[name=scope]")).toHaveValue(`map:${customerMapId}`);
  await form.$("input[name=title]").setValue(title);
  await form.$("textarea[name=description]").setValue("Die CSV-Auswahl im Ablauf ausprobieren.");
  if (withDesign) {
    await form.$("select[name=style-guide]").selectByAttribute("value", style);
    await form.$("select[name=design-system]").selectByAttribute("value", system);
  }
  await el("prototype-save").click();
  await expect(el("prototype-detail").$("h1")).toHaveText(title);
}

it("exports the SM-01 mapped stories, linked NFR criterion and one scoped relationship", async () => {
  await createMapBrief("Übergabe im Prototyp prüfen", true);
  await expect(el("prototype-export-brief")).toBeDisplayed();
  const download = await captureDownload("prototype-export-brief");
  expect(download.name).toMatch(/^PT-\d+-Briefing\.md$/);
  expect(download.text).toContain("Alle passenden Fälle als CSV exportieren");
  expect(download.text).toContain(
    "Kein Fall aus einer anderen Organisation ist in der exportierten Datei.",
  );
  expect(download.text).toContain("Übergabeauftrag");
  expect(download.text).toContain("umfasst");
  expect(download.text).toContain("Servicefenster");
  expect(download.text).toContain("0..*");
  expect(download.text.match(/REL-61/g)).toHaveLength(1);
  expect(download.text).toContain(styleBody);
  expect(download.text).toContain(systemBody);
});

it("returns from prototype design and context notes to the exact brief link by keyboard", async () => {
  await createMapBrief("Beim Briefing zur Quelle und zurück", true);
  const origin = await readViewRoute();
  if (
    !origin ||
    typeof origin !== "object" ||
    !("prototypeId" in origin) ||
    typeof origin.prototypeId !== "string" ||
    !isPrototypeId(origin.prototypeId)
  )
    throw new Error("Expected an exact prototype detail route");
  const activate = async (control: WebdriverIO.Element) => {
    await browser.execute((node: HTMLElement) => node.focus(), control);
    await browser.keys("Enter");
  };
  const context = el("prototype-brief-context");
  for (const [key, noteId] of [
    ["prototype-design-style-guide", style],
    ["prototype-design-design-system", system],
    ["prototype-brief-note-" + customerRequirement, customerRequirement],
  ] as const) {
    if (noteId === customerRequirement) await activate(await context.$("summary"));
    const link = browser.$(`${ROOT} [data-pe-focus-key="${key}"]`);
    await expect(link).toBeDisplayed();
    await activate(await link);
    const back = el("project-record-return");
    await expect(back).toHaveText("Zum vorherigen Bereich zurückkehren");
    const linked = await readViewRoute();
    await activate(await back);
    await expect(back).not.toExist();
    const returned = await readViewRoute();
    process.stdout.write(`V16 explicit note return ${JSON.stringify({ key, linked, returned })}\n`);
    expect(returned).toEqual(origin);
    expect(linked).toEqual(
      knowledgeDetailRoute(customerProject, noteId, {
        section: "prototypes",
        reference: { kind: "prototype", recordId: origin.prototypeId },
      }),
    );
    await expect(link).toBeFocused();
  }
});

it("imports exact native UTF-8 bytes and keeps the local preview through a brief edit and reload", async () => {
  const title = "Klickbare Übergabe mit Datei";
  const name = "Übergabe – offline.html";
  const html =
    '\uFEFF<!doctype html>\r\n<html lang="de"><body>\r\n' +
    "<button onclick=\"document.getElementById('result').textContent='Grüße ✓'\">Ausprobieren</button>\r\n" +
    '<p id="result">Bereit</p>\r\n</body></html>\r\n';
  const folder = await mkdtemp(join(tmpdir(), "pe-v16-html-"));
  const fixture = join(folder, name);
  try {
    await writeFile(fixture, html, "utf8");
    await createMapBrief(title);
    const route = await readViewRoute();
    await expect(el("prototype-import-html")).toBeDisplayed();
    await el("prototype-import-html").click();
    await el("prototype-html-file").setValue(fixture);
    await expect(el("prototype-html-source")).toHaveValue(expect.stringContaining("Ausprobieren"));
    await el("prototype-html-save").click();
    await expect(el("prototype-html-source")).not.toExist();
    const preview = el("prototype-preview");
    await expect(preview).toHaveAttribute("title", "Interaktive Prototypvorschau");
    await browser.switchFrame(await preview);
    try {
      await browser.$("button=Ausprobieren").click();
      await expect(browser.$("#result")).toHaveText("Grüße ✓");
    } finally {
      await browser.switchFrame(null);
    }
    const downloaded = await captureDownload("prototype-export-html");
    expect(downloaded.name).toBe(name);
    expect(downloaded.bytes).toEqual([...Buffer.from(html, "utf8")]);
    await el("prototype-edit").click();
    await el("prototype-form").$("textarea[name=description]").setValue("Geänderte Beschreibung.");
    await el("prototype-save").click();
    await expect(el("prototype-detail").$("[data-output-status=stale]")).toBeDisplayed();
    await el("prototype-import-html").click();
    await browser.keys("Escape");
    await expect(el("prototype-html-source")).not.toExist();
    await expect(el("prototype-import-html")).toBeFocused();
    await el("prototype-import-html").click();
    await el("prototype-html-source").setValue("kein HTML");
    await el("prototype-html-save").click();
    await expect(el("prototype-import-form").$("[role=alert]")).toBeDisplayed();
    await el("prototype-html-cancel").click();
    await browser.reloadObsidian();
    await openView();
    await setViewRoute(route);
    await expect(el("prototype-detail").$("h1")).toHaveText(title);
    expect((await captureDownload("prototype-export-html")).bytes).toEqual(downloaded.bytes);
    await el("prototype-scope").$("button").click();
    expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId));
    const disclosure = el("story-map-context-prototypes");
    if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
    const backlink = el("prototype-source-links").$(`button=${title}`);
    await expect(backlink).toBeDisplayed();
    await backlink.click();
    expect((await captureDownload("prototype-export-html")).bytes).toEqual(downloaded.bytes);
  } finally {
    await rm(fixture, { force: true });
    await rmdir(folder);
  }
});

it("exports only explicitly selected foundation text and labels missing and binary references", async () => {
  await browser.executeObsidian(async ({ app }, mapPath) => {
    await app.vault.createFolder("Prototyp-Quellen");
    await app.vault.create(
      "Prototyp-Quellen/Übergabe.txt",
      "Beleg aus der tatsächlichen Datei: Grüße.\r\n" +
        "x".repeat(512 * 1024) +
        "Außerhalb des Auszugs",
    );
    await app.vault.create("Prototyp-Quellen/Nicht ausgewählt.txt", "Ungewählte Nachbardatei");
    await app.vault.createBinary(
      "Prototyp-Quellen/Skizze.png",
      Uint8Array.from([0, 255, 128]).buffer,
    );
    const map = app.vault.getFileByPath(mapPath);
    if (!map) throw new Error("SM-01 missing");
    await app.fileManager.processFrontMatter(map, (fields: Record<string, unknown>) => {
      fields.references = [
        "[[Prototyp-Quellen/Übergabe.txt|Dateibeleg]]",
        "![[Prototyp-Quellen/Skizze.png]]",
        "[[Prototyp-Quellen/Verschwunden.md|Vermisste Quelle]]",
      ];
    });
  }, matchedMapPath);
  await createMapBrief("Übergabe mit ausgewählten Dateien");
  const { text } = await captureDownload("prototype-export-brief");
  expect(text).toContain("Beleg aus der tatsächlichen Datei: Grüße.");
  expect(text).toContain("Auszug, erste 512 KiB");
  expect(text).toContain("Dateibeleg");
  expect(text).toContain("Vermisste Quelle");
  expect(text).toContain("Binärdatei");
  expect(text).not.toContain("Ungewählte Nachbardatei");
  expect(text).not.toContain("Außerhalb des Auszugs");
});

it("marks only changed scoped input stale, and retries a rejected native output write", async () => {
  const title = "Eingaben der Übergabe aktuell halten";
  await createMapBrief(title);
  const route = await readViewRoute();
  if (
    !route ||
    typeof route !== "object" ||
    !("prototypeId" in route) ||
    typeof route.prototypeId !== "string"
  )
    throw new Error("Expected typed prototype route");
  const status = (name: string) => el("prototype-detail").$(`[data-output-status=${name}]`);
  const original = "<main>Ursprünglicher Prüfstand ✓</main>";
  await el("prototype-import-html").click();
  await el("prototype-html-source").setValue(original);
  await el("prototype-html-save").click();
  await expect(status("recorded")).toBeDisplayed();
  const originalBrief = await captureDownload("prototype-export-brief");
  await browser.executeObsidian(async ({ app }, path) => {
    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Missing boundary note");
    await app.vault.process(file, (raw) => raw + "\nÄnderung außerhalb des Umfangs.\n");
  }, adminFolder + "/Admin-Prototyp.md");
  const after = await captureDownload("prototype-export-brief");
  expect(after.bytes).toEqual(originalBrief.bytes);
  await expect(status("recorded")).toBeDisplayed();
  await browser.executeObsidian(async ({ app }, path) => {
    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Missing scoped NFR");
    await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
      fields.acceptance = "Geändertes Kriterium für die eigene Organisation.";
    });
  }, prototypeNfrPath);
  await expect(status("stale")).toBeDisplayed();
  expect((await captureDownload("prototype-export-brief")).text).toContain(
    "Geändertes Kriterium für die eigene Organisation.",
  );
  expect((await captureDownload("prototype-export-html")).text).toBe(original);

  await el("prototype-import-html").click();
  const replacement = "<main>Erneut geprüfter Stand ✓</main>";
  await el("prototype-html-source").setValue(replacement);
  await browser.executeObsidian(({ app }, id) => {
    const process = app.vault.process.bind(app.vault);
    app.vault.process = (file, change, options) =>
      process(
        file,
        (raw) => {
          const next = change(raw);
          if (file.path.includes(id) && next.includes("Erneut geprüfter Stand")) {
            app.vault.process = process;
            throw new Error("Controlled native HTML write refusal");
          }
          return next;
        },
        options,
      );
  }, route.prototypeId);
  await el("prototype-html-save").click();
  await expect(el("prototype-import-form").$("[role=alert]")).toBeDisplayed();
  await expect(el("prototype-html-source")).toHaveValue(replacement);
  await el("prototype-html-save").click();
  await expect(el("prototype-import-form")).not.toExist();
  await expect(status("recorded")).toBeDisplayed();
  expect((await captureDownload("prototype-export-html")).text).toBe(replacement);
  await el("prototype-import-html").click();
  await el("prototype-html-source").setValue("<main>Veralteter Entwurf</main>");
  await browser.executeObsidian(async ({ app }, id) => {
    const file = app.vault.getMarkdownFiles().find(({ path }) => path.includes(id));
    if (!file) throw new Error("Missing native prototype");
    await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
      fields.description = "Parallel in der Vault bearbeitete Beschreibung.";
    });
  }, route.prototypeId);
  await el("prototype-html-save").click();
  await expect(el("prototype-import-form").$("[role=alert]")).toHaveText(
    expect.stringContaining("Grundlagen haben sich geändert"),
  );
  await el("prototype-html-cancel").click();
  expect((await captureDownload("prototype-export-html")).text).toBe(replacement);
  process.stdout.write(
    "V16 stale scope measured: unrelated exact brief equality and recorded → NFR changed stale → retry recorded → outside edit preserved saved HTML\n",
  );
});

it("exports the canonical item's hierarchy, companion work, explicit PRD and acceptance criteria", async () => {
  const acceptance = "Die Datei enthält genau die gefilterten Fälle.";
  await browser.executeObsidian(
    async ({ app }, path, prd, job, criterion) => {
      const note = app.vault.getFileByPath(path);
      if (!note) throw new Error("Missing native UC-09");
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        Object.assign(fields, {
          pbi_prd_id: prd,
          pbi_job_id: job,
          pbi_requirement_id: "REQ-18",
          pbi_criteria: [
            {
              id: "AC-61",
              text: criterion,
              scenario_id: "SC-61",
              scenario_name: "Gefilterter Export",
              given: "Die Liste ist gefiltert",
              when: "Ich exportiere sie",
              then_step: criterion,
            },
          ],
        });
      });
    },
    `${work}/UC-09.md`,
    customerRequirement,
    jobOne,
    acceptance,
  );
  const source = pbiDetailRoute(customerProject, "UC-09");
  await setViewRoute(source);
  const links = el("prototype-source-links");
  await links.$("[data-testid=prototype-create]").click();
  const form = el("prototype-form");
  await expect(form.$("select[name=scope]")).toHaveValue("UC:UC-09");
  const title = "CSV aus dem Use Case prüfen";
  await form.$("input[name=title]").setValue(title);
  await form.$("textarea[name=description]").setValue("Prüfe den Export aus dem Use Case.");
  await el("prototype-save").click();
  await expect(el("prototype-detail").$("h1")).toHaveText(title);
  const brief = await captureDownload("prototype-export-brief");
  for (const fragment of ["Servicefälle verwalten", "TASK-05", "REQ-18", "JOB-12", acceptance])
    expect(brief.text).toContain(fragment);
  await el("prototype-scope").$("button").click();
  expect(await readViewRoute()).toEqual(source);
  const backlink = links.$(`button=${title}`);
  await expect(backlink).toBeDisplayed();
  await backlink.click();
  await expect(el("prototype-detail").$("h1")).toHaveText(title);
  await el("prototype-scope").$("button").click();
  await expect(backlink).toBeFocused();
});
