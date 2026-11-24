import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { projectOverviewRoute } from "../../../src/application/projects";
import { adminProject } from "../knowledge-vault";
import { seedBlankOverviewVault } from "../overview-vault";
import { openView, readViewRoute, ROOT, setViewRoute } from "../support";

const entry = () => browser.$(`${ROOT} [data-testid=project-workspace]`);

it("starts the first unassigned Job from the empty overview and returns focus on cancel", async () => {
  await seedBlankOverviewVault();
  await openView();
  const overview = projectOverviewRoute(adminProject);
  await setViewRoute(overview);
  await expect(entry().$("h1")).toHaveText("Admin Console");
  const first = entry().$("button=Ersten Job beschreiben");
  await expect(first).toBeDisplayed();
  await browser.execute((element: HTMLElement) => element.focus(), await first);
  await browser.keys("Enter");
  const modal = browser.$(`${ROOT} [role=dialog][data-state=open]`);
  await expect(modal.$('[name="title"]')).toBeFocused();
  await expect(modal.$('[name="owner_id"]')).toHaveValue("");
  await browser.keys("Escape");
  await expect(first).toBeFocused();
  expect(await readViewRoute()).toEqual(overview);
});
