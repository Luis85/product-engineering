import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { splitNoteText } from "../../../src/domain/notes";
import { exportPath } from "../backlog-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { deliveryPath, deliveryRequest } from "../request-delivery-vault";
import {
  markFixtureAccepted,
  reviewTestedCommit,
  seedReviewRegisterVault,
} from "../review-register-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  ROOT,
  setTheme,
  setViewRoute,
  writeVaultText,
} from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = (id: string) => browser.$(`${ROOT} [data-review-row="${id}"]`);
const register = reviewsRoute(customerProject);
const selected = reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 });
const stale = () => row("FR-024").$('[data-testid="review-stale"]');

it("V19: keeps keyboard order and exact tested evidence through external PBI change, Back and reload", async function () {
  this.timeout(120_000);
  const originalRevision = await seedReviewRegisterVault(true);
  await setViewRoute(register);
  const title = () => row("FR-024").$("button");
  await expect(title()).toBeDisplayed();
  await expect(row("FR-023").$("button")).toBeDisplayed();
  await expect(el("review-register-headings")).toBeDisplayed();
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  await expect(el("review-register-headings")).not.toBeDisplayed();
  const business = () => row("FR-024").$('[data-testid="review-business"]');
  const technical = () => row("FR-024").$('[data-testid="review-technical"]');
  await expect(business().$(".pe-request-field-label")).toHaveText("Fachliche Abnahme");
  await expect(technical().$(".pe-request-field-label")).toHaveText("Technische Prüfung");
  const geometry = await browser.execute(
    (table: HTMLElement, first: HTMLElement, second: HTMLElement) => ({
      spill: table.scrollWidth - table.clientWidth,
      gap: second.getBoundingClientRect().top - first.getBoundingClientRect().bottom,
    }),
    await el("review-register").$("table"),
    await business(),
    await technical(),
  );
  expect(geometry.spill).toBeLessThanOrEqual(1);
  expect(geometry.gap).toBeGreaterThanOrEqual(-1);
  const heading = el("review-register").$("h1");
  await browser.execute((node: HTMLElement) => node.focus(), await heading);
  await browser.keys("Tab");
  await expect(title()).toBeFocused();
  await browser.keys("Tab");
  await expect(row("FR-023").$("button")).toBeFocused();
  await browser.keys(["Shift", "Tab"]);
  await expect(title()).toBeFocused();

  const original = await readVaultText(exportPath);
  if (!original || !originalRevision) throw new Error("Missing released PBI revision");
  const parsed = splitNoteText(original);
  expect(parsed.body).toContain("## Historie");
  const revised = original.replace("---\n", `---\npbi_revision: ${originalRevision + 1}\n`);
  expect(revised).toContain(`pbi_revision: ${originalRevision + 1}\n`);
  await writeVaultText(exportPath, revised + "\nExterne Änderung am PBI.\n");
  await expect(stale()).toHaveText("Früherer Stand", { wait: 20_000 });
  await expect(title()).toBeFocused();
  await markFixtureAccepted();
  await expect(business()).toHaveText(expect.stringContaining("Abgenommen"));
  await expect(technical()).toHaveText(expect.stringContaining("CI bestanden"));
  await expect(title()).toBeFocused();
  const before = await readVaultText(deliveryPath);

  await browser.keys("Enter");
  await expect(el("request-detail").$("h1")).toBeFocused();
  expect(await readViewRoute()).toEqual(selected);
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await browser.keys(["Shift", "Tab"]);
  await expect(el("review-return")).toBeFocused();
  await browser.keys("Enter");
  await expect(title()).toBeFocused();
  await browser.keys("Tab");
  await expect(row("FR-023").$("button")).toBeFocused();
  await browser.reloadObsidian();
  await openView();
  await expect(stale()).toHaveText("Früherer Stand");
  expect(await readViewRoute()).toEqual(register);
  await expect(business()).toHaveText(expect.stringContaining("Abgenommen"));
  await expect(row("FR-024").$("code")).toHaveAttribute("title", reviewTestedCommit);
  expect(await readVaultText(deliveryPath)).toBe(before);
});
