import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import { newNoteText } from "../../../src/domain/notes";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerFolder, customerProject } from "../knowledge-vault";
import { seedPbiVault } from "../pbi-vault";
import { requestFolder } from "../request-vault";
import { openView, ROOT, setViewRoute } from "../support";

const request = "feature-request-33333333-3333-4333-8333-000000000024";
const prdPath = "PRD-03.md";
const change = "Eine CSV-Zeile pro gefiltertem Servicefall.";
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

async function key(button: WebdriverIO.Element) {
  await expect(button).toBeDisplayed({ wait: 15_000 });
  await browser.execute((node: HTMLElement) => node.focus(), button);
  await browser.keys("Enter");
}

it("V18: refuses a dirty release and restores the PRD-03 repair control on return", async () => {
  const { git, baseline } = await seedPbiVault();
  await browser.executeObsidian(
    async ({ app }, folder, draft, prd, addedText) => {
      const source = app.vault.getFileByPath(prd);
      if (!source) throw new Error("Missing PRD-03 in the disposable Vault");
      await app.vault.process(source, (original) => original + "\n" + addedText + "\n");
      await app.vault.createFolder(folder);
      await app.vault.create(folder + "/FR-024.md", draft);
    },
    requestFolder,
    newNoteText({
      schema: "product-engineering.feature-request/v1",
      id: request,
      project_id: customerProject,
      display_id: "FR-024",
      pbi_id: "UC-09",
      title: "CSV-Export · Servicefälle",
      scope: "Gefilterte Servicefälle im CSV bereitstellen.",
      sequence: 24,
      revision: 2,
      state: "draft",
    }),
    customerFolder + "/" + prdPath,
    change,
  );
  expect(git("show", baseline + ":" + prdPath)).not.toContain(change);
  expect(git("diff", "--", prdPath)).toContain("+" + change);

  await openView();
  await setViewRoute(featureRequestsRoute(customerProject, { requestId: request, tab: "gates" }));
  await narrowKnowledgeLeaf();
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1740,
    height: 550,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(el("request-release")).toBeDisplayed();
  await expect(el("request-release")).toBeDisabled();
  await expect(el("request-gates")).toHaveText(expect.stringContaining("PRD-03"), { wait: 15_000 });
  const repair = el("request-gates").$("button*=PRD-03");
  await key(await repair);
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("PRD-03"));
  await key(await el("project-record-return"));
  await expect(repair).toBeDisplayed({ wait: 15_000 });
  await expect(repair).toBeFocused();
  expect(git("rev-parse", "HEAD")).toBe(baseline);
});
