import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import { customerFolder, customerProject } from "../knowledge-vault";
import {
  changeFixtureFile,
  deliveryPath,
  deliveryRequest,
  deliveryScope,
  prdChange,
  seedRequestDeliveryVault,
} from "../request-delivery-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const state = async (name: string) =>
  expect(el("request-state")).toHaveText(name, { wait: 15_000 });

it("V18: blocks stale dispatch and records exactly one local run with clarification, retry and verified evidence", async () => {
  await seedRequestDeliveryVault(true);
  await openView();
  await setViewRoute(
    featureRequestsRoute(customerProject, { requestId: deliveryRequest, tab: "gates" }),
  );
  await expect(el("request-release")).toBeEnabled({ wait: 15_000 });
  await el("request-release").click();
  await state("Freigegeben");
  await el("request-tab-run").click();
  await expect(el("request-dispatch")).toBeDisplayed();
  const prd = customerFolder + "/PRD-03.md";
  await changeFixtureFile(prd, "", prdChange);
  await expect(el("request-stale")).toBeDisplayed({ wait: 15_000 });
  await expect(el("request-dispatch")).toBeDisabled();
  expect(await readVaultText(deliveryPath)).not.toContain("run_id:");
  await changeFixtureFile(prd, "\n" + prdChange + "\n", "");
  await expect(el("request-dispatch")).toBeEnabled({ wait: 15_000 });
  await browser.execute(
    (button: HTMLElement) => {
      button.click();
      button.click();
    },
    await el("request-dispatch"),
  );
  await state("Warteschlange");
  await expect(el("request-attempt")).toHaveText(expect.stringContaining("Versuch 1"));
  const runId = await el("request-attempt").$("code").getText();
  await el("request-fixture-pickup").click();
  await state("Läuft");
  await el("request-replay-event").click();
  await el("request-fixture-question").click();
  await state("Rückfrage");
  const form = el("request-clarification");
  await expect(form.$("blockquote")).toHaveText(deliveryScope);
  await form.$("textarea").setValue("Die Auswahl stimmt.");
  await el("request-answer").click();
  await state("Läuft");
  await el("request-fixture-fail").click();
  await state("Fehlgeschlagen");
  await expect(el("request-retry")).toBeEnabled();
  await el("request-retry").click();
  await state("Warteschlange");
  await expect(el("request-attempt")).toHaveText(expect.stringContaining("Versuch 2"));
  await expect(el("request-attempt").$("code")).toHaveText(runId);
  await el("request-fixture-pickup").click();
  await state("Läuft");
  await el("request-fixture-verify").click();
  await state("In Review");
  await expect(el("request-technical-result")).toHaveText(expect.stringContaining("LOCAL-PR"));
  await el("request-run-history").$("summary").click();
  expect(await el("request-run-history").$$("li").length).toBe(8);
  await el("request-tab-evidence").click();
  await expect(el("request-evidence")).toHaveText(
    expect.stringContaining("Fachliche Entscheidung"),
  );
  const criterion = el("request-evidence").$("[data-evidence-criterion=AC-09]");
  await criterion.$("summary").click();
  await expect(criterion).toHaveText(expect.stringContaining("SC-09"));
  await expect(criterion).toHaveText(expect.stringContaining("Versuch 2"));
});
