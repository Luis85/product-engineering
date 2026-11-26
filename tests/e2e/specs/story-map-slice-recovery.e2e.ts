import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { storyMapSliceRoute, storyMapsRoute } from "../../../src/application/story-maps";
import { work } from "../backlog-vault";
import { customerProject } from "../knowledge-vault";
import { fields } from "../story-map-handoff";
import { customerMapId, matchedMapPath, seedStoryMapsVault } from "../story-maps-vault";
import { openView, readVaultText, readViewRoute, ROOT, setTheme } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const first = () => el("slice-review-story-CARD-01");
const dialog = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const review = (slice: string) => el("story-map-slice-review-" + slice);
const existingBacklogIds = () =>
  browser.executeObsidian(async ({ app }, root) => {
    const files = app.vault.getMarkdownFiles().filter((note) => note.path.startsWith(root + "/"));
    const notes = await Promise.all(files.map((note) => app.vault.cachedRead(note)));
    return notes
      .flatMap((raw) => {
        if (!/^type: PBI$/m.test(raw)) return [];
        const id = /^pe-id: (UC-\S+)$/m.exec(raw)?.[1];
        return id ? [id] : [];
      })
      .toSorted();
  }, work);
const receipt = async () => fields((await readVaultText(matchedMapPath)) ?? "");

it("keeps the existing staged PBI when an outside edit moves its card to a different slice", async () => {
  await seedStoryMapsVault();
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setTheme("light");
  await browser.$(ROOT).$("button=Kundenportal").click();
  await el("project-rail").$('button[aria-label="Story Maps"]').click();
  await el("story-map-row").click();
  await review("SL-01").click();
  const before = await existingBacklogIds();
  await first().$("button=PBI aus Story anlegen").click();
  await expect(dialog().$('select[name="parent"]')).toHaveValue("FE-01");
  await browser.executeObsidian(({ app }, path) => {
    const original = app.vault.process.bind(app.vault);
    app.vault.process = (file, change, options) =>
      original(
        file,
        (raw) => {
          const next = change(raw);
          if (file.path === path && next.includes("state: created")) {
            app.vault.process = original;
            throw new Error("Controlled native refusal after the PBI has been published");
          }
          return next;
        },
        options,
      );
  }, matchedMapPath);
  await el("backlog-save").click();
  await expect(dialog().$("[role=alert]")).toHaveText(
    expect.stringContaining("Die Notiz konnte nicht gespeichert werden"),
  );
  const interrupted = await existingBacklogIds();
  const created = interrupted.find((id) => !before.includes(id));
  if (!created) throw new Error("No PBI was published before the test refusal");
  expect(interrupted.length).toBe(before.length + 1);
  expect((await receipt()).slice_handoffs).toMatchObject([
    { state: "pending", cardId: "CARD-01", sliceId: "SL-01", itemId: created },
  ]);
  await el("backlog-cancel").click();
  await expect(dialog()).not.toExist();
  await browser.executeObsidian(async ({ app }, path) => {
    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Missing fixture map");
    await app.fileManager.processFrontMatter(file, (data: Record<string, unknown>) => {
      const cards = data.cards as Record<string, unknown>[];
      const card = cards.find(({ id }) => id === "CARD-01");
      if (!card) throw new Error("Missing fixture Story");
      card.sliceId = "SL-02";
    });
  }, matchedMapPath);
  await expect(first()).not.toExist();
  await el("frame-history").$('button[aria-label="Zurück"]').click();
  await review("SL-02").click();
  expect(await readViewRoute()).toEqual(
    storyMapSliceRoute(customerProject, customerMapId, "SL-02"),
  );
  await expect(first()).toBeDisplayed();

  const createAgain = first().$("button=PBI aus Story anlegen");
  if (await createAgain.isExisting()) {
    await createAgain.click();
    await expect(dialog().$('[name="title"]')).toBeDisplayed();
    await el("backlog-save").click();
    await browser.waitUntil(async () => {
      if ((await existingBacklogIds()).length > interrupted.length) return true;
      return (await dialog().isExisting()) && (await dialog().$("[role=alert]").isDisplayed());
    });
  }
  expect(await existingBacklogIds()).toEqual(interrupted);
  expect((await receipt()).slice_handoffs).toMatchObject([
    { state: "pending", cardId: "CARD-01", sliceId: "SL-01", itemId: created },
  ]);

  await expect(first()).toHaveText(expect.stringContaining("Erster nutzbarer Ablauf"));
  const recover = () => first().$("button=Story in der Story Map öffnen");
  await expect(recover()).toBeDisplayed();
  await recover().click();
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId, "CARD-01"));
  const cardControl = () => el("story-map-card-CARD-01").$('[data-story-node="CARD-01"]');
  await expect(cardControl()).toBeFocused();
  await el("frame-history").$('button[aria-label="Zurück"]').click();
  await expect(first()).toBeFocused();
  await recover().click();
  await expect(cardControl()).toBeFocused();
  await cardControl().click();
  await el("story-map-card-edit").click();
  await dialog().$('[name="sliceId"]').selectByAttribute("value", "SL-01");
  await el("story-map-journey-save").click();
  await expect(el("story-map-cell-SL-01-STEP-01")).toHaveText(
    expect.stringContaining("Meine Fallübersicht sehen"),
  );
  await review("SL-01").click();
  await first().$("button=PBI-Erstellung abschließen").click();
  await el("backlog-save").click();
  await expect(first().$(`[data-story-item="${created}"]`)).toBeDisplayed();
  await expect(first()).toBeFocused();
  expect(await existingBacklogIds()).toEqual(interrupted);
  expect((await receipt()).slice_handoffs).toMatchObject([
    { state: "created", cardId: "CARD-01", sliceId: "SL-01", itemId: created },
  ]);
});
