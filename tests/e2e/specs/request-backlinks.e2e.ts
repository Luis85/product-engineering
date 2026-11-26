import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { customerProject } from "../knowledge-vault";
import { readyPbiId, requestFolder, seedRequestsVault } from "../request-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const heading = () => browser.$(`${ROOT} [data-testid=request-detail] h1`);
const card = (id: string, stage?: string) =>
  browser.$(`${ROOT} ${stage ? `[data-board-stage="${stage}"] ` : ""}[data-board-card="${id}"]`);
const field = (name: string) => browser.$(`${ROOT} [data-testid=request-form] [name="${name}"]`);
const request = (scope: ReturnType<typeof card>, id: string) =>
  scope.$(`[data-request-link="${id}"]`);
const search = () => browser.$(`${ROOT} [data-testid=backlog-board] input[name=backlog-search]`);

async function press(control: WebdriverIO.Element) {
  await expect(control).toBeDisplayed();
  await browser.execute((element: HTMLElement) => element.focus(), control);
  await browser.keys("Enter");
}

async function requestNotes() {
  return browser.executeObsidian(
    ({ app }, prefix) =>
      app.vault
        .getMarkdownFiles()
        .map(({ path }) => path)
        .filter((path) => path.startsWith(prefix + "/"))
        .toSorted(),
    requestFolder,
  );
}

it("V17: keeps one contextual draft on the original board lane and links it from Board, Liste and PBI", async () => {
  await seedRequestsVault();
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  const existing = card("UC-09", "In Development");
  await expect(card("UC-09")).toBeDisplayed();
  await expect(existing).toBeDisplayed();
  await expect(request(existing, "FR-024")).toBeDisplayed();
  await search().setValue(readyPbiId);
  const source = card(readyPbiId, "Open");
  const create = source.$("button=Feature Request erstellen");
  await press(await create);
  await expect(field("pbiId")).toHaveValue(readyPbiId);
  await expect(field("scope")).toHaveValue("Gesamter Use-Case");
  await field("title").setValue("Filter ausliefern");
  await field("scope").setValue("Bestätigte Filter in die CSV übernehmen");
  await browser.execute(
    (button: HTMLElement) => {
      button.click();
      button.click();
    },
    await el("request-save"),
  );
  await expect(heading()).toHaveText("Filter ausliefern");
  await expect(el("request-scope")).toHaveText("Bestätigte Filter in die CSV übernehmen");
  await expect(el("request-detail-pbi")).toHaveText(readyPbiId);
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-025 · Revision 1"));
  await press(await el("request-toggle-gates"));
  await expect(el("request-gates")).toHaveText(expect.stringContaining("2/2 erfüllt"));
  const notes = await requestNotes();
  expect(notes).toHaveLength(2);
  const stored = notes.find((path) => path.includes("FR-025"));
  if (!stored) throw new Error("Missing stored Feature Request draft");
  expect(await readVaultText(stored)).toContain("pbi_id: " + readyPbiId);
  await press(await el("request-return"));
  await expect(search()).toHaveValue(readyPbiId);
  const linked = request(source, "FR-025");
  await expect(linked).toBeFocused();
  await press(await linked);
  await expect(heading()).toHaveText("Filter ausliefern");
  expect(await requestNotes()).toEqual(notes);
  const selected = await readViewRoute();
  expect(selected).toMatchObject({ origin: { kind: "board", context: { query: readyPbiId } } });
  if (!selected || typeof selected !== "object" || !("requestId" in selected))
    throw new Error("Missing the selected draft route");
  await browser.waitUntil(
    async () => {
      const saved = await readVaultText(".obsidian/workspace.json");
      return saved?.includes(String(selected.requestId)) ?? false;
    },
    { timeout: 15_000 },
  );
  await browser.reloadObsidian();
  await expect(heading()).toHaveText("Filter ausliefern");
  await expect(el("request-return")).toHaveText("Zurück zum Board");
  await press(await el("request-return"));
  await expect(search()).toHaveValue(readyPbiId);
  const restarted = card(readyPbiId, "Open");
  await expect(restarted).toBeDisplayed();
  await expect(request(restarted, "FR-025")).toBeDisplayed();
  await expect(request(restarted, "FR-025")).toBeFocused();
  await expect(restarted.$("button=Feature Request erstellen")).not.toExist();
  await browser.executeObsidian(async ({ app }, path) => {
    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Expected the persisted draft before changing the local fixture");
    await app.vault.process(file, (text) => text.replace(/^state: draft$/m, "state: released"));
  }, stored);
  await expect(restarted).toHaveText(expect.stringContaining("Freigegeben"));
  await expect(restarted).toBeDisplayed();
  await el("backlog-board").$("button=Liste").click();
  const row = browser.$(`${ROOT} [data-backlog-id="${readyPbiId}"]`);
  await expect(row.$('[data-request-link="FR-025"]')).toBeDisplayed();
  await row.$("[data-testid=backlog-row-open]").click();
  await el("pbi-tab-links").click();
  await expect(
    browser.$(`${ROOT} [data-testid=pbi-detail] [data-request-link="FR-025"]`),
  ).toBeDisplayed();
});
