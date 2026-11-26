import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { newNoteText } from "../../../src/domain/notes";
import { isPrototypeId } from "../../../src/domain/prototypes";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerFolder, customerProject, customerRequirement } from "../knowledge-vault";
import { capturePrototypeDownload } from "../prototype-native";
import { seedPrototypesVault } from "../prototype-vault";
import { customerMapId, matchedPrdTitle } from "../story-maps-vault";
import { openView, readViewRoute, ROOT, setTheme, setViewRoute } from "../support";

const element = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const detail = () => element("prototype-detail");
const noteLink = (key: string) => browser.$(`${ROOT} [data-pe-focus-key="${key}"]`);
const context = () => element("prototype-brief-context");
const style = "knowledge-33333333-3333-4333-8333-000000000706";
const system = "knowledge-33333333-3333-4333-8333-000000000707";
const entity = "knowledge-33333333-3333-4333-8333-000000000701";
const neighbor = "knowledge-33333333-3333-4333-8333-000000000702";
const scopedPath = `${customerFolder}/Geltender Prüffall.md`;
const title = "Externen CSV-Übergabeauftrag prüfen";

async function activate(control: WebdriverIO.Element) {
  await browser.execute((node: HTMLElement) => node.focus(), control);
  await browser.keys("Enter");
}

async function seed() {
  await seedPrototypesVault();
  const records = [
    {
      title: "Geltender Prüffall",
      kind: "entity",
      id: entity,
      display_id: "ENT-71",
      body: "Definition der erfassten Fälle.",
      domain_scope: [
        { kind: "map", id: customerMapId },
        { kind: "prd", id: customerRequirement },
      ],
      domain_edges: [
        {
          id: "REL-71",
          target: neighbor,
          verb: "gehört zu",
          sourceCardinality: "1",
          targetCardinality: "0..*",
          rule: "Nur freigegebene Servicefälle.",
        },
      ],
    },
    {
      title: "Benannte Einsatzgruppe",
      kind: "entity",
      id: neighbor,
      display_id: "ENT-72",
      body: "Definition außerhalb des direkten Umfangs.",
    },
    {
      title: "Markenfarben für Übergaben",
      kind: "style-guide",
      id: style,
      display_id: "SG-71",
      body: "Farbregeln für bestätigte Exporte.",
    },
    {
      title: "Steuerelemente für Übergaben",
      kind: "design-system",
      id: system,
      display_id: "DS-71",
      body: "Schaltflächen mit sichtbarem Tastaturfokus.",
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
  await browser.executeObsidian(async ({ app }, files) => {
    for (const { path, raw } of files) await app.vault.create(path, raw);
  }, records);
}

async function createMapBrief() {
  const disclosure = element("story-map-context-prototypes");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await element("prototype-source-links").$("[data-testid=prototype-create]").click();
  const form = element("prototype-form");
  await expect(form.$("select[name=scope]")).toHaveValue(`map:${customerMapId}`);
  await form.$("input[name=title]").setValue(title);
  await form
    .$("textarea[name=description]")
    .setValue("Geltende Fälle passend filtern und übergeben.");
  await form.$("select[name=style-guide]").selectByAttribute("value", style);
  await form.$("select[name=design-system]").selectByAttribute("value", system);
  await element("prototype-save").click();
  await expect(detail().$("h1")).toHaveText(title);
}

function updateScopedTitle(nextTitle: string) {
  return browser.executeObsidian(
    async ({ app }, path, label) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Expected the scoped entity");
      await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
        fields.title = label;
      });
    },
    scopedPath,
    nextTitle,
  );
}

it("keeps keyboard focus on the PRD link after a map backlink, both design notes and a live refresh", async () => {
  await seed();
  await openView();
  const map = storyMapsRoute(customerProject, customerMapId);
  await setViewRoute(map);
  await narrowKnowledgeLeaf();
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1740,
    height: 550,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await setTheme("dark");
  await createMapBrief();
  const origin = await readViewRoute();
  if (
    !origin ||
    typeof origin !== "object" ||
    !("prototypeId" in origin) ||
    !isPrototypeId(origin.prototypeId)
  )
    throw new Error("Expected an exact saved prototype");
  const { prototypeId } = origin;
  await activate(await context().$("summary"));
  await expect(context()).toHaveText(
    expect.stringContaining("Geltender Prüffall → gehört zu → Benannte Einsatzgruppe"),
  );
  const exported = await capturePrototypeDownload(await element("prototype-export-brief"));
  expect(exported.text).toContain("REL-71");

  const styleKey = "prototype-design-style-guide";
  await activate(await noteLink(styleKey));
  await expect(browser.$(ROOT).$("h1=Markenfarben für Übergaben")).toBeDisplayed();
  await activate(await element("frame-history").$("button[aria-label=Zurück]"));
  await expect(noteLink(styleKey)).toBeFocused();
  await activate(await element("prototype-scope").$("button"));
  expect(await readViewRoute()).toEqual(map);
  const disclosure = element("story-map-context-prototypes");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  const backlink = element("prototype-source-links").$(`button=${title}`);
  await activate(await backlink);
  await activate(await element("prototype-scope").$("button"));
  await expect(backlink).toBeFocused();
  await setViewRoute(origin);
  await expect(detail().$("h1")).toHaveText(title);

  const prdKey = "prototype-brief-note-" + customerRequirement;
  for (const [key, id, heading] of [
    [styleKey, style, "Markenfarben für Übergaben"],
    ["prototype-design-design-system", system, "Steuerelemente für Übergaben"],
    [prdKey, customerRequirement, matchedPrdTitle],
  ] as const) {
    if (key === prdKey) await activate(await context().$("summary"));
    await expect(noteLink(key)).toBeDisplayed();
    await activate(await noteLink(key));
    await expect(browser.$(ROOT).$(`h1=${heading}`)).toBeDisplayed();
    expect(await readViewRoute()).toEqual(
      knowledgeDetailRoute(customerProject, id, {
        section: "prototypes",
        reference: { kind: "prototype", recordId: prototypeId },
      }),
    );
    await activate(await element("project-record-return"));
    await expect(detail().$("h1")).toHaveText(title);
    expect(await readViewRoute()).toEqual(origin);
    await expect(noteLink(key)).toBeDisplayed();
    await expect(noteLink(key)).toBeFocused();
  }

  await updateScopedTitle("Aktualisierter Prüffall");
  await expect(context()).toHaveText(expect.stringContaining("Aktualisierter Prüffall"));
  await expect(noteLink(prdKey)).toBeDisplayed();
  const active = await browser.execute(() =>
    document.activeElement?.getAttribute("data-pe-focus-key"),
  );
  process.stdout.write(
    `V16 settled PRD focus after the scoped Vault refresh ${JSON.stringify(active)}\n`,
  );
  await expect(noteLink(prdKey)).toBeFocused();

  const edit = element("prototype-edit");
  await browser.execute((control: HTMLElement) => control.focus(), await edit);
  await updateScopedTitle("Geprüfter Übergabefall");
  await expect(context()).toHaveText(expect.stringContaining("Geprüfter Übergabefall"));
  await expect(edit).toBeFocused();
});
