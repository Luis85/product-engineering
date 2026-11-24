import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { traceRoute } from "../../../src/application/trace";
import { customerProject } from "../knowledge-vault";
import { openView, ROOT, setViewRoute } from "../support";
import { seedComparisonTrace } from "../trace-vault";

const select = () => browser.$(`${ROOT} [data-testid="trace-pbi"]`);

it("V21: an active Trace leaf restores its non-leading PBI after reopening Obsidian", async function () {
  this.timeout(90_000);
  await seedComparisonTrace();
  await setViewRoute(traceRoute(customerProject));
  await expect(select()).toBeDisplayed();
  await expect(select()).toHaveValue("UC-09");
  await select().selectByAttribute("value", "UC-12");
  await expect(select()).toHaveValue("UC-12");
  await expect(browser.$(`${ROOT} [data-trace-card="CARD-04"]`)).toBeDisplayed();
  await browser.reloadObsidian();
  await openView();
  await expect(select()).toBeDisplayed();
  await expect(select()).toHaveValue("UC-12");
  await expect(browser.$(`${ROOT} [data-trace-card="CARD-04"]`)).toBeDisplayed();
});
