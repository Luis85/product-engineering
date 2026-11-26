import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import type { StoredRequestPackage } from "../../../src/application/feature-requests";
import { customerFolder, customerProject } from "../knowledge-vault";
import { capturePrototypeDownload as captureDownload } from "../prototype-native";
import {
  changeFixtureFile,
  deliveryPath,
  deliveryRequest,
  prdChange,
  seedRequestDeliveryVault,
} from "../request-delivery-vault";
import {
  installConsoleSpy,
  openView,
  pluginProblems,
  readVaultText,
  ROOT,
  setViewRoute,
} from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

it("V18: commits dirty PRD-03 via Knowledge, releases and exports the reviewed package bytes", async () => {
  const { git, baseline } = await seedRequestDeliveryVault(true, false);
  await installConsoleSpy();
  await changeFixtureFile(customerFolder + "/PRD-03.md", "", prdChange);
  await openView();
  await setViewRoute(
    featureRequestsRoute(customerProject, { requestId: deliveryRequest, tab: "gates" }),
  );
  await expect(el("request-release")).toBeDisabled();
  const repair = el("request-gates").$("button*=PRD-03");
  await expect(repair).toBeDisplayed({ wait: 15_000 });
  await repair.click();
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("PRD-03"));
  await el("knowledge-history-tab").click();
  await el("git-commit").click();
  const commit = el("git-commit-form");
  await commit.$("input[name=message]").setValue("PRD-03 für Paket festschreiben");
  await commit.$("button[type=submit]").click();
  await expect(el("git-announcement")).toBeDisplayed({ wait: 15_000 });
  const oid = git("rev-parse", "HEAD");
  expect(oid).not.toBe(baseline);
  expect(git("show", oid + ":PRD-03.md")).toContain(prdChange);
  await el("frame-history").$("button:first-child").click();
  await expect(el("request-release")).toBeDisplayed();
  await expect(el("request-release")).toBeEnabled({ wait: 15_000 });
  await el("request-release").click();
  try {
    await browser.waitUntil(
      async () => /state:\s+released/.test((await readVaultText(deliveryPath)) ?? ""),
      { timeout: 15_000 },
    );
  } catch {
    throw new Error(
      `The release was not durably written. ${JSON.stringify(await pluginProblems())}`,
    );
  }
  await expect(el("request-detail")).toHaveText(expect.stringContaining("Freigegeben"));
  await el("request-tab-package").click();
  await expect(el("request-export")).toBeDisplayed();
  await expect(el("request-nfrs")).toHaveText(expect.stringContaining("Keine Einträge"));
  await expect(el("request-domain")).toHaveText(expect.stringContaining("Keine Einträge"));
  const { text } = await captureDownload(await el("request-export"));
  const { package: payload } = JSON.parse(text) as StoredRequestPackage;
  expect(payload.nfrs).toEqual([]);
  expect(payload.domain).toEqual({ entities: [], edges: [], neighbors: [] });
  expect(payload.attachments.find(({ displayId }) => displayId === "PRD-03")).toMatchObject({
    commit: oid,
  });
  await browser.$(`${ROOT} [data-attachment=PRD-03] summary`).click();
  await expect(browser.$(`${ROOT} [data-attachment=PRD-03] pre`)).toHaveText(
    expect.stringContaining(prdChange),
  );
});
