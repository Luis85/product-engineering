import { createHash } from "node:crypto";
import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import {
  canonicalRequestJson,
  featureRequestsRoute,
} from "../../../src/application/feature-requests";
import type { StoredRequestPackage } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import { capturePrototypeDownload as captureDownload } from "../prototype-native";
import { deliveryPath, deliveryRequest, seedRequestDeliveryVault } from "../request-delivery-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

it("V18: refuses a Factory acknowledgement when freshly read export bytes were altered", async function () {
  this.timeout(90_000);
  await seedRequestDeliveryVault(true);
  await openView();
  await setViewRoute(
    featureRequestsRoute(customerProject, { requestId: deliveryRequest, tab: "gates" }),
  );
  await expect(el("request-release")).toBeEnabled({ wait: 15_000 });
  await el("request-release").click();
  await expect(el("request-state")).toHaveText("Freigegeben", { wait: 15_000 });
  await el("request-tab-package").click();
  const before = await captureDownload(await el("request-export"));
  const stored = JSON.parse(before.text) as StoredRequestPackage;
  const altered = {
    ...stored.package,
    addedAfterRelease: "Eine Änderung am Paket außerhalb des Plugins.",
  };
  const injected = canonicalRequestJson({ ...stored, package: altered });
  expect(createHash("sha256").update(canonicalRequestJson(altered)).digest("hex")).not.toBe(
    stored.checksum?.value,
  );
  await browser.executeObsidian(
    async ({ app }, path, replacement) => {
      const note = app.vault.getFileByPath(path);
      if (!note) throw new Error("Missing FR-024");
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        const state = JSON.parse(String(fields.delivery_data)) as {
          current: { exportJson: string };
        };
        state.current.exportJson = replacement;
        fields.delivery_data = JSON.stringify(state);
      });
    },
    deliveryPath,
    injected,
  );

  await browser.reloadObsidian();
  await openView();
  await setViewRoute(featureRequestsRoute(customerProject, { requestId: deliveryRequest }));
  await expect(el("request-state")).toHaveText("Freigegeben", { wait: 15_000 });
  await el("request-tab-run").click();
  await expect(el("request-run")).toBeDisplayed();
  const dispatch = el("request-dispatch");
  if (await dispatch.isExisting()) {
    await expect(dispatch).toBeEnabled({ wait: 15_000 });
    await dispatch.click();
    await browser.waitUntil(
      async () =>
        (await el("request-state").getText()) === "Warteschlange" ||
        (await el("request-run").$("[role=alert]").isExisting()),
      { timeout: 15_000 },
    );
  }
  const current = await readVaultText(deliveryPath);
  expect(current?.includes("run_id:")).toBe(false);
  await expect(el("request-package-integrity")).toHaveText(
    expect.stringContaining("Folgerevision"),
  );
  await expect(el("request-followup")).toBeDisplayed();
  await el("request-tab-package").click();
  await expect(el("request-export")).not.toExist();
});
