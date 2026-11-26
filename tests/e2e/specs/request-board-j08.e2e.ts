import { createHash } from "node:crypto";
import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import type { StoredRequestPackage } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { capturePrototypeDownload as captureDownload } from "../prototype-native";
import {
  changeFixtureFile,
  deliveryCriterion,
  deliveryPath,
  deliveryRequest,
  deliveryScope,
  entityAfter,
  entityBefore,
  entityPath,
  nfrAfter,
  nfrBefore,
  nfrPath,
  seedRequestDeliveryVault,
} from "../request-delivery-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const card = (stage: string) =>
  browser.$(`${ROOT} [data-board-stage="${stage}"] [data-board-card="UC-09"]`);
const link = "[data-request-link=FR-024]";
const detail = featureRequestsRoute(customerProject, { requestId: deliveryRequest });
const editedScope = deliveryScope + " Bericht am selben Tag.";

async function keyActivate(element: WebdriverIO.Element) {
  await expect(element).toBeDisplayed();
  await browser.execute((node: HTMLElement) => node.focus(), element);
  await browser.keys("Enter");
}

it("J08: projects the acknowledged request across Board, List and PBI, keeps frozen A, and drafts live B", async function () {
  this.timeout(120_000);
  const { git } = await seedRequestDeliveryVault(false);
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(card("In Progress")).toBeDisplayed();
  await keyActivate(await card("In Progress").$(link));
  await narrowKnowledgeLeaf();
  const packageTab = el("request-tab-package");
  await expect(packageTab).toHaveAttribute("aria-selected", "true");
  await browser.execute((node: HTMLElement) => node.focus(), await packageTab);
  await browser.keys("ArrowRight");
  await expect(el("request-toggle-gates")).toBeFocused();
  await browser.keys("Enter");
  const check = el("request-confirm-ready");
  await expect(check).toBeDisplayed({ wait: 15_000 });
  await expect(el("request-release")).toBeDisabled();
  await check.click();
  await expect(el("request-release")).toBeEnabled({ wait: 15_000 });
  await keyActivate(await el("request-edit-scope"));
  const area = el("request-scope-form").$("textarea[name=scope]");
  await expect(area).toBeFocused();
  await area.setValue(editedScope);
  await keyActivate(await el("request-save-scope"));
  await expect(el("request-scope")).toHaveText(editedScope);
  await expect(check).not.toBeChecked();
  await expect(el("request-release")).toBeDisabled();
  await check.click();
  await expect(el("request-release")).toBeEnabled({ wait: 15_000 });
  await keyActivate(await el("request-release"));
  await expect(el("request-state")).toHaveText("Freigegeben", { wait: 15_000 });
  await el("request-return").click();
  await expect(card("In Progress").$(link)).toBeDisplayed();
  await keyActivate(await card("In Progress").$(link));
  await keyActivate(await packageTab);
  const a = await captureDownload(await el("request-export"));
  const frozen = JSON.parse(a.text) as StoredRequestPackage;
  const sha = createHash("sha256").update(JSON.stringify(frozen.package)).digest("hex");
  expect(a.name).toBe("FR-024-rev-2.json");
  expect(frozen.checksum?.value).toBe(sha);
  expect(frozen.package).toMatchObject({
    scope: editedScope,
    useCase: { criteria: [deliveryCriterion] },
    nfrs: [{ acceptance: nfrBefore }],
  });
  expect(frozen.package.domain?.entities[0]?.definition).toContain(entityBefore);
  expect(frozen.package.attachments.find(({ displayId }) => displayId === "PRD-03")?.commit).toBe(
    git("log", "-1", "--format=%H", "--", "PRD-03.md"),
  );

  await keyActivate(await el("request-tab-run"));
  await expect(el("request-dispatch")).toBeEnabled({ wait: 15_000 });
  await keyActivate(await el("request-dispatch"));
  await expect(el("request-state")).toHaveText("Warteschlange");
  await el("request-fixture-pickup").click();
  await expect(el("request-state")).toHaveText("Läuft");
  const picked = await readVaultText(deliveryPath);
  await el("request-replay-event").click();
  expect(await readVaultText(deliveryPath)).toBe(picked);
  await el("request-fixture-verify").click();
  await expect(el("request-state")).toHaveText("In Review");
  await el("request-return").click();
  await expect(card("In Development").$(link)).toBeDisplayed();
  await el("backlog-board").$("button=Liste").click();
  const row = browser.$(`${ROOT} [data-backlog-id=UC-09]`);
  await expect(row.$(link)).toHaveText(expect.stringContaining("FR-024"));
  await row.$("[data-testid=backlog-row-open]").click();
  await el("pbi-tab-links").click();
  const pbiLink = browser.$(`${ROOT} [data-testid=pbi-detail] ${link}`);
  await keyActivate(await pbiLink);
  await expect(el("request-state")).toHaveText("In Review");

  await changeFixtureFile(nfrPath, nfrBefore, nfrAfter);
  await changeFixtureFile(entityPath, entityBefore, entityAfter);
  await expect(el("request-scope-advisory")).toBeDisplayed();
  await expect(el("request-stale")).not.toExist();
  await browser.reloadObsidian();
  await openView();
  await setViewRoute(detail);
  await expect(el("request-export")).toBeDisplayed();
  expect((await captureDownload(await el("request-export"))).bytes).toEqual(a.bytes);
  await el("request-tab-run").click();
  await expect(el("request-followup")).toBeDisplayed();
  await el("request-followup").click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 3"));
  await expect(el("request-state")).toHaveText("Entwurf");
  await el("request-nfrs").$("summary").click();
  await expect(el("request-nfrs")).toHaveText(expect.stringContaining(nfrAfter));
  await el("request-domain").$("summary").click();
  await expect(el("request-domain")).toHaveText(expect.stringContaining(entityAfter));
  await el("request-history").$("summary").click();
  await el("request-history").$('[data-history-revision="2"]').click();
  expect((await captureDownload(await el("request-export"))).bytes).toEqual(a.bytes);
  await el("request-tab-run").click();
  const b = await readVaultText(deliveryPath);
  await el("request-replay-event").click();
  expect(await readVaultText(deliveryPath)).toBe(b);
  await el("request-current-revision").click();
  await expect(el("request-state")).toHaveText("Entwurf");
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(card("In Development").$(link)).toBeDisplayed();
});
