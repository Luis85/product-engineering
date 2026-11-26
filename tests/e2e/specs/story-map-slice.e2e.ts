import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogRoute, pbiDetailRoute } from "../../../src/application/backlog";
import { storyMapsRoute, storyMapSliceRoute } from "../../../src/application/story-maps";
import { newNoteText } from "../../../src/domain/notes";
import { epicPath, featurePath, work } from "../backlog-vault";
import { adminFolder, adminProject, customerProject, jobOne } from "../knowledge-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminMapId, customerMapId, matchedMapPath, seedStoryMapsVault } from "../story-maps-vault";
import { openView, readVaultText, readViewRoute, ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = (id: string) => el(`slice-review-story-${id}`);
const dialog = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const entry = () => el("story-map-slice-review-SL-01");
const header = () => el("slice-review").$("h1");
const back = () => el("frame-history").$('button[aria-label="Zurück"]');

function coveredDecisionContrast() {
  return browser.execute((root) => {
    const list = document.querySelector(root + " .pe-story-slice-list");
    const canvas = document.createElement("canvas");
    const paint = canvas.getContext("2d", { willReadFrequently: true });
    if (!list || !paint) throw new Error("Missing slice list or color sampling context");

    const linearLight = (byte: number) => {
      const value = byte / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: string) => {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = color;
      paint.fillRect(0, 0, 1, 1);
      const [red = 0, green = 0, blue = 0, alpha] = paint.getImageData(0, 0, 1, 1).data;
      if (alpha !== 255) throw new Error("Expected an opaque color for " + color);
      return 0.2126 * linearLight(red) + 0.7152 * linearLight(green) + 0.0722 * linearLight(blue);
    };
    const background = luminance(getComputedStyle(list).backgroundColor);
    return Array.from(
      list.querySelectorAll('.pe-story-slice-decision[data-covered="true"]'),
      (pill) => {
        const foreground = luminance(getComputedStyle(pill).color);
        return (
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        );
      },
    );
  }, ROOT);
}

function editFixture(mapPath: string, action: "expose" | "move") {
  return browser.executeObsidian(
    async ({ app }, path, mode, own, other) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing the actual story map");
      await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        const cards = frontmatter.cards as Record<string, unknown>[];
        const extra = cards.find(({ id }) => id === "CARD-05");
        if (!extra) throw new Error("Missing the fixture card");
        extra.sliceId = mode === "expose" ? "SL-01" : "SL-02";
        if (mode !== "expose") return;
        const links = frontmatter.card_links as Record<string, unknown>[];
        links.push(
          { cardId: "CARD-05", kind: "item", projectId: other, recordId: "UC-09" },
          { cardId: "CARD-05", kind: "item", projectId: own, recordId: "UC-94" },
        );
        frontmatter.outside_handoff_field = "Vorhandene Anmerkung";
      });
    },
    mapPath,
    action,
    customerProject,
    adminProject,
  );
}

before(async () => {
  await seedStoryMapsVault();
  await browser.sendCommandAndGetResult("Network.enable", {});
  await browser.sendCommandAndGetResult("Network.setBlockedURLs", {
    urls: ["*iconify.design*", "*simplesvg.com*", "*unisvg.com*"],
  });
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setTheme("light");
  await browser.$(ROOT).$("button=Kundenportal").click();
  await el("project-rail").$('button[aria-label="Story Maps"]').click();
  await el("story-map-row").click();
  await expect(el("story-map-detail")).toBeDisplayed();
});

it("keeps covered decision text readable in both Obsidian themes", async () => {
  await entry().click();
  await expect(el("slice-review-count")).toHaveText("2 von 3 Storys mit PBI");
  for (const theme of ["dark", "light"] as const) {
    await setTheme(theme);
    const ratios = await coveredDecisionContrast();
    expect(ratios).toHaveLength(2);
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
  }
  await back().click();
  await expect(entry()).toBeFocused();
});

it("reviews one slice and prefills canonical PBI creation from an uncovered story", async () => {
  const review = entry();
  await expect(review).toHaveText("Fürs Backlog prüfen");
  await review.click();
  await expect(el("slice-review").$("h1")).toHaveText("Erster nutzbarer Ablauf");
  await expect(el("slice-review-count")).toHaveText("2 von 3 Storys mit PBI");
  const ordered = await el("slice-review")
    .$$("[data-slice-story]")
    .map((story) => story.getAttribute("data-slice-story"));
  expect(ordered).toEqual(["CARD-01", "CARD-02", "CARD-03"]);
  await expect(row("CARD-01")).toHaveText(
    expect.stringContaining("Arbeit vorbereiten › Fallübersicht öffnen"),
  );
  await expect(
    row("CARD-01").$("button=Vorhandenes Item verknüpfen").$("svg path:first-of-type"),
  ).toBeDisplayed();
  await expect(row("CARD-04")).not.toExist();
  await expect(row("CARD-05")).not.toExist();
  expect(await readViewRoute()).toMatchObject({
    projectId: customerProject,
    mapId: customerMapId,
    sliceId: "SL-01",
  });
  await row("CARD-01").$("button=PBI aus Story anlegen").click();
  await expect(dialog().$('[name="title"]')).toHaveValue("Meine Fallübersicht sehen");
  await expect(dialog().$('[name="markdown"]')).toHaveValue(
    "Die Koordinatorin sieht nur Fälle ihrer Organisation.",
  );
  await expect(dialog().$('[name="parent"]')).toHaveValue("FE-01");
  await expect(dialog().$('[name="owner"]')).toHaveValue("");
  await expect(dialog().$('[name="prd"]')).toHaveValue(expect.stringContaining("PRD-03 · REQ-18"));
  await expect(dialog().$('[name="job"]')).toHaveValue(jobOne);
  await browser.keys("Escape");
  await expect(row("CARD-01")).toBeFocused();
  await row("CARD-01").$("button=PBI aus Story anlegen").click();
  await dialog().$("button=PBI anlegen und verknüpfen").click();
  await expect(row("CARD-01")).toHaveText(expect.stringContaining("Neu angelegt"));
  await expect(el("slice-review-count")).toHaveText("3 von 3 Storys mit PBI");
});

it("reuses the same canonical PBI on a second story and counts each story once", async () => {
  const first = row("CARD-01");
  const canonical = await first.$('[data-story-item^="UC-"]').getAttribute("data-story-item");
  if (!canonical) throw new Error("The first story did not create a PBI");
  const second = row("CARD-02");
  await second.$("button=Vorhandenes Item verknüpfen").click();
  await dialog().$('[name="story-backlog-item"]').selectByAttribute("value", canonical);
  await el("story-map-link-save").click();
  await expect(second).toBeFocused();
  await expect(second.$(`[data-story-item="${canonical}"]`)).toBeDisplayed();
  await expect(second).toHaveText(expect.stringContaining("Bestehendes PBI"));
  await expect(el("slice-review-count")).toHaveText("3 von 3 Storys mit PBI");
});

it("opens the correct native Feature, Epic and supporting work editor from typed story links", async () => {
  await browser.executeObsidian(
    async ({ app }, epic, task, taskText) => {
      const file = app.vault.getFileByPath(epic);
      if (!file) throw new Error("Missing fixture Epic");
      await app.vault.process(file, (raw) =>
        raw.replace(
          "---\n",
          "---\nschema: product-engineering.backlog/v1\nid: backlog-33333333-3333-4333-8333-000000000592\n",
        ),
      );
      await app.vault.create(task, taskText);
    },
    epicPath,
    work + "/TASK-18.md",
    newNoteText(
      {
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000593",
        "pe-id": "TASK-18",
        project_id: customerProject,
        type: "Task",
        title: "Bearbeiter informieren",
        parent: "[[UC-14]]",
      },
      "",
    ),
  );
  const add = async (id: string) => {
    await row("CARD-01").$("button=Vorhandenes Item verknüpfen").click();
    const picker = dialog().$('[name="story-backlog-item"]');
    await expect(picker.$(`option[value="${id}"]`)).toExist();
    await picker.selectByAttribute("value", id);
    await el("story-map-link-save").click();
    await expect(row("CARD-01")).toBeFocused();
  };
  for (const item of ["EP-01", "TASK-18"]) await add(item);
  for (const [id, title] of [
    ["FE-01", "Servicefälle verwalten"],
    ["EP-01", "Kundenservice"],
    ["TASK-18", "Bearbeiter informieren"],
  ] as const) {
    const control = () => row("CARD-01").$(`[data-story-item="${id}"]`);
    await expect(control()).toBeDisplayed();
    await control().click();
    expect(await readViewRoute()).toEqual(backlogRoute(customerProject, id));
    await expect(dialog().$('[name="title"]')).toHaveValue(title);
    await el("backlog-return-story-map").click();
    await expect(control()).toBeFocused();
  }
  await expect(el("slice-review-count")).toHaveText("3 von 3 Storys mit PBI");
});

it("rejects a same-ID record in another project and a story moved while its draft is open", async () => {
  await browser.executeObsidian(
    async ({ app }, path, content) => {
      await app.vault.create(path, content);
    },
    adminFolder + "/UC-94.md",
    newNoteText(
      {
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000591",
        "pe-id": "UC-94",
        project_id: adminProject,
        type: "PBI",
        title: "Projektfremder Eintrag",
      },
      "",
    ),
  );
  await editFixture(matchedMapPath, "expose");
  const other = () => row("CARD-05");
  await expect(other()).toHaveText(expect.stringContaining("PBI offen"));
  await expect(other()).toHaveText(
    expect.stringContaining("UC-09 · Der Verweis ist in diesem Projekt nicht verfügbar."),
  );
  await expect(other()).toHaveText(
    expect.stringContaining("UC-94 · Der Verweis ist in diesem Projekt nicht verfügbar."),
  );
  await expect(el("slice-review-count")).toHaveText("3 von 4 Storys mit PBI");
  await other().$("button=Vorhandenes Item verknüpfen").click();
  await expect(dialog().$('option[value="UC-94"]')).not.toExist();
  await browser.keys("Escape");
  await expect(other()).toBeFocused();
  const feature = await readVaultText(featurePath);
  const existing = await readVaultText(work + "/UC-14.md");
  await other().$("button=Zurückstellen").click();
  await expect(other()).toHaveText(expect.stringContaining("Zurückgestellt"));
  await expect(other().$("button=PBI aus Story anlegen")).not.toExist();
  await expect(other()).toBeFocused();
  await other().$("button=Wieder aufnehmen").click();
  await expect(other()).toHaveText(expect.stringContaining("PBI offen"));
  await other().$("button=PBI aus Story anlegen").click();
  await expect(dialog().$('[name="title"]')).toHaveValue("Übergabeliste mit dem Team teilen");
  await editFixture(matchedMapPath, "move");
  await expect(other()).not.toExist();
  const external = await readVaultText(matchedMapPath);
  await el("backlog-save").click();
  await expect(dialog().$("[role=alert]")).toHaveText(
    expect.stringContaining("Die Story oder ihre Verknüpfungen wurden geändert."),
  );
  await expect(dialog().$('[name="title"]')).toHaveValue("Übergabeliste mit dem Team teilen");
  expect(await readVaultText(matchedMapPath)).toBe(external);
  expect(await readVaultText(featurePath)).toBe(feature);
  expect(await readVaultText(work + "/UC-14.md")).toBe(existing);
  await browser.keys("Escape");
  await setViewRoute(storyMapSliceRoute(adminProject, adminMapId, "SL-01"));
  await expect(el("slice-review")).toHaveText(
    expect.stringContaining("Dieser Lieferabschnitt ist in der Story Map nicht verfügbar."),
  );
  await expect(row("CARD-01")).not.toExist();
  await el("slice-review").$("button=Zur Story Map").click();
  expect(await readViewRoute()).toEqual(storyMapsRoute(adminProject, adminMapId));
});

it("restores the reading position and focus and opens renamed work in a short 390px leaf", async () => {
  const withCard = storyMapsRoute(customerProject, customerMapId, "CARD-02");
  await setViewRoute(withCard);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1080,
    height: 680,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const region = () => el("story-map-scroll");
  await expect(entry()).toBeDisplayed();
  const offset = await browser.execute(
    (scroller: HTMLElement) => {
      scroller.scrollLeft = 140;
      scroller.scrollTop = 35;
      return { left: scroller.scrollLeft, top: scroller.scrollTop };
    },
    await region(),
  );
  expect(offset.left).toBeGreaterThan(0);
  await browser.execute(
    (button: HTMLElement) => button.focus({ preventScroll: true }),
    await entry(),
  );
  await browser.keys("Enter");
  await expect(header()).toHaveText("Erster nutzbarer Ablauf");
  await back().click();
  expect(await readViewRoute()).toEqual(withCard);
  await expect(entry()).toBeFocused();
  expect(
    await browser.execute(
      (scroller: HTMLElement) => ({ left: scroller.scrollLeft, top: scroller.scrollTop }),
      await region(),
    ),
  ).toEqual(offset);
  await el("story-map-add-slice").click();
  await dialog().$('[name="title"]').setValue("Leerer Lieferabschnitt");
  await el("story-map-journey-save").click();
  const emptyHeader = () =>
    el("story-map-detail").$("h3=Leerer Lieferabschnitt").parentElement().parentElement();
  await emptyHeader().$("button=Fürs Backlog prüfen").click();
  await expect(header()).toHaveText("Leerer Lieferabschnitt");
  await expect(el("slice-review")).toHaveText(
    expect.stringContaining("Diesem Lieferabschnitt sind noch keine Storys zugeordnet."),
  );
  await el("slice-review").$("button=Zur Story Map").click();
  expect(await readViewRoute()).toEqual(withCard);
  await expect(emptyHeader().$("button=Fürs Backlog prüfen")).toBeFocused();

  await narrowKnowledgeLeaf();
  await setTheme("dark");
  await entry().click();
  await expect(header()).toHaveText("Erster nutzbarer Ablauf");
  const screen = await browser.execute(
    (review: HTMLElement) => {
      const leaf = review.closest<HTMLElement>(".workspace-leaf");
      return {
        width: Math.round(leaf?.getBoundingClientRect().width ?? 0),
        overflow: review.scrollWidth - review.clientWidth,
      };
    },
    await el("slice-review"),
  );
  expect(screen).toEqual({ width: 390, overflow: 0 });
  const existingLink = () => row("CARD-02").$('[data-story-item="UC-14"]');
  const oldPath = work + "/UC-14.md";
  const moved = work + "/Extern verschoben/Fallfilter.md";
  const bytes = await readVaultText(oldPath);
  await browser.executeObsidian(
    async ({ app }, from, to) => {
      const note = app.vault.getFileByPath(from);
      if (!note) throw new Error("Missing canonical PBI before outside move");
      await app.vault.createFolder(to.slice(0, to.lastIndexOf("/")));
      await app.vault.rename(note, to);
    },
    oldPath,
    moved,
  );
  await expect(existingLink()).toBeDisplayed();
  await existingLink().click();
  await expect(el("pbi-detail").$("h1")).toHaveText("Fallübersicht nach Status filtern");
  await expect(el("pbi-return")).toHaveText("Zur Backlog-Prüfung");
  expect(await readViewRoute()).toEqual(pbiDetailRoute(customerProject, "UC-14"));
  expect(await readVaultText(moved)).toBe(bytes);
  await el("pbi-return").click();
  await expect(existingLink()).toBeFocused();
  await row("CARD-02").$("button=Vorhandenes Item verknüpfen").click();
  await expect(dialog()).toBeDisplayed();
  await expect(el("story-map-link-save")).toBeDisplayed();
  await browser.keys("Escape");
  await expect(row("CARD-02")).toBeFocused();
  await setViewRoute(storyMapSliceRoute(customerProject, customerMapId, "SL-02"));
  await row("CARD-05").$("button=PBI aus Story anlegen").click();
  await expect(dialog().$('[name="title"]')).toBeFocused();
  await el("backlog-save").scrollIntoView();
  expect(
    await browser.execute(
      (button: HTMLElement) => {
        const { left, top, width, height } = button.getBoundingClientRect();
        return button.contains(
          button.ownerDocument.elementFromPoint(left + width / 2, top + height / 2),
        );
      },
      await el("backlog-save"),
    ),
  ).toBe(true);
  await browser.keys("Escape");
  await expect(row("CARD-05")).toBeFocused();
});
