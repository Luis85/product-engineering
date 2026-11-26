import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { customerProject } from "../knowledge-vault";
import { readyPbiId, seedRequestsVault } from "../request-vault";
import { openView, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const card = (id: string) => browser.$(`${ROOT} [data-board-card="${id}"]`);

it("V17: opens a contextual Feature Request draft for the eligible second PBI", async () => {
  await seedRequestsVault();
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(card("UC-09")).toBeDisplayed();
  const source = card(readyPbiId);
  await expect(source).toHaveText(expect.stringContaining("Bereit für den Request-Entwurf"));
  const create = source.$("button=Feature Request erstellen");
  await expect(create).toBeDisplayed();
  await create.click();
  await expect(el("request-form")).toBeDisplayed();
  await expect(browser.$(`${ROOT} [data-testid=request-form] select[name=pbiId]`)).toHaveValue(
    readyPbiId,
  );
});
