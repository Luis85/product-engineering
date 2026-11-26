import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import { deliveryStages } from "../../../src/domain/feature-requests";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { seedRequestsVault } from "../request-vault";
import { openView, ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = () => browser.$(`${ROOT} [data-request-row=FR-024]`);

async function press(control: WebdriverIO.Element) {
  await expect(control).toBeDisplayed();
  await browser.execute((button: HTMLElement) => button.focus(), control);
  await browser.keys("Enter");
}

it("V17: renders the FR-024 register projection, exact stage counts and focused gate return in native Obsidian", async () => {
  await seedRequestsVault();
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  const entry = el("project-rail").$("button=Feature Requests");
  await expect(entry).toBeDisplayed();
  await press(await entry);
  await expect(el("request-register")).toBeDisplayed();
  await expect(row()).toHaveText(expect.stringContaining("CSV-Export · Servicefälle"));
  await expect(row()).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(row()).toHaveText(expect.stringContaining("UC-09"));
  await expect(row()).toHaveText(expect.stringContaining("In Review"));
  await expect(row()).toHaveText(expect.stringContaining("RUN-042"));
  await expect(el("request-register-headings")).toBeDisplayed();
  for (const stage of deliveryStages) {
    await setViewRoute(featureRequestsRoute(customerProject, { stage }));
    await expect(el("request-filter-count")).toHaveText(
      `${stage === "review" ? 1 : 0} von 1 Requests`,
    );
    if (stage !== "review") {
      await expect(el("request-empty")).toHaveText(
        "In dieser Lieferphase gibt es keine Feature Requests.",
      );
      await expect(row()).not.toExist();
    }
    await press(await el("request-show-all"));
    await expect(el("request-filter-count")).not.toExist();
    await expect(row()).toBeDisplayed();
  }

  await setViewRoute(featureRequestsRoute(customerProject, { stage: "review" }));
  const gates = row().$("[data-testid=request-row-gates]");
  await expect(gates).toHaveText("Done · 2/3 erfüllt");
  await press(await gates);
  await expect(el("request-detail")).toHaveText(
    expect.stringContaining("CSV-Export · Servicefälle"),
  );
  await expect(el("request-gates")).toBeDisplayed();
  await expect(el("request-gates")).toHaveText(expect.stringContaining("Ready & Done"));
  await expect(el("request-gates")).toHaveText(expect.stringContaining("2/3 erfüllt"));
  await press(await el("request-return"));
  await expect(el("request-filter-count")).toHaveText("1 von 1 Requests");
  await expect(gates).toBeFocused();

  await narrowKnowledgeLeaf();
  await setTheme("dark");
  await expect(el("request-register-headings")).not.toBeDisplayed();
  await expect(row().$("[data-testid=request-delivery-label]")).toHaveText("Lieferstand");
  await expect(row().$("[data-testid=request-gates-label]")).toHaveText("Freigabekriterien");
  const spill = await browser.execute(
    (register: HTMLElement) => register.scrollWidth - register.clientWidth,
    await el("request-register"),
  );
  expect(spill).toBeLessThanOrEqual(1);
});
