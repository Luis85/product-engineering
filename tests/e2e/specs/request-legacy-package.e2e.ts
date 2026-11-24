import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import { capturePrototypeDownload as captureDownload } from "../prototype-native";
import { deliveryRequest } from "../request-delivery-vault";
import { seedLegacyRequestPackage } from "../request-package-reference";
import { openView, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

it("V18: reads the existing FR-024 package with unrecorded scope independently of live notes", async () => {
  const expected = await seedLegacyRequestPackage();
  await openView();
  await setViewRoute(
    featureRequestsRoute(customerProject, { requestId: deliveryRequest, tab: "gates" }),
  );
  await expect(el("request-state")).toHaveText("In Review");
  await expect(el("request-toggle-gates")).toHaveAttribute("aria-selected", "true");
  await el("request-tab-package").click();
  await expect(el("request-package")).toHaveText(expect.stringContaining("REQ-18"));
  await expect(el("request-nfrs")).toHaveText(expect.stringContaining("Stand unbekannt"));
  await expect(el("request-domain")).toHaveText(expect.stringContaining("Stand unbekannt"));
  expect((await captureDownload(await el("request-export"))).text).toBe(expected);
  await browser.$(`${ROOT} [data-attachment=PRD-03] summary`).click();
  await expect(browser.$(`${ROOT} [data-attachment=PRD-03] pre`)).toHaveText(
    expect.stringContaining("vollständig weitergeben"),
  );
  await browser.$(`${ROOT} [data-attachment=PRD-03] button`).click();
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("PRD-03"));
  await el("project-record-return").click();
  await expect(el("request-tab-package")).toHaveAttribute("aria-selected", "true");
  await expect(browser.$(`${ROOT} [data-attachment=PRD-03] button`)).toBeFocused();
});
