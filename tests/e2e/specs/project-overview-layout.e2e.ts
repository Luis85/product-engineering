import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { projectOverviewRoute } from "../../../src/application/projects";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { seedComparisonOverview } from "../overview-delivery-vault";
import { ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = (record: string) => browser.$(`${ROOT} [data-overview-pbi="${record}"]`);
const title = () => browser.$(`${ROOT} [data-overview-pbi="UC-09"] td:first-child button`);
const width = async () =>
  browser.execute(
    (area: HTMLElement) => area.getBoundingClientRect().width,
    await el("project-content"),
  );
const back = () => el("frame-history").$('button[aria-label="Zurück"]');

async function expectTaskContentContained() {
  const tasks = el("overview-tasks");
  await expect(tasks).toBeDisplayed();
  await expect(tasks).toHaveText(expect.stringContaining("PRD-Anforderung verknüpfen"));
  const facts = await browser.execute(
    (section: HTMLElement) => {
      const list = section.querySelector("ul")?.getBoundingClientRect();
      return Array.from(section.querySelectorAll("li"), (entry) => {
        const parts = ["button", "strong", "small", ".pe-overview-phase-icon"].map((selector) =>
          entry.querySelector(selector)?.getBoundingClientRect(),
        );
        const [button, taskTitle, reason, icon] = parts;
        function contains(outer: DOMRect | undefined, inner: DOMRect | undefined) {
          if (!outer || !inner) return false;
          return (
            inner.top >= outer.top - 1 &&
            inner.bottom <= outer.bottom + 1 &&
            inner.left >= outer.left - 1 &&
            inner.right <= outer.right + 1
          );
        }
        return {
          buttonInsideList: contains(list, button),
          titleInsideButton: contains(button, taskTitle),
          reasonInsideButton: contains(button, reason),
          iconInsideButton: contains(button, icon),
        };
      });
    },
    await tasks,
  );
  expect(facts).toEqual([
    {
      buttonInsideList: true,
      titleInsideButton: true,
      reasonInsideButton: true,
      iconInsideButton: true,
    },
  ]);
}

it("shows ranked work and canonical foundations, with full narrow titles and keyboard Back focus", async function () {
  this.timeout(105_000);
  await seedComparisonOverview();
  await setTheme("light");
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await setViewRoute(projectOverviewRoute(customerProject));
  await expect(el("overview-ranked")).toBeDisplayed();
  const rows = el("overview-ranked").$$("tr[data-overview-pbi]");
  await expect(rows).toBeElementsArrayOfSize(3);
  const ids = await browser.execute(
    (table: HTMLElement) =>
      Array.from(
        table.querySelectorAll<HTMLElement>("[data-overview-pbi]"),
        (item) => item.dataset.overviewPbi,
      ),
    await el("overview-ranked"),
  );
  expect(ids).toEqual(["UC-09", "UC-14", "UC-12"]);
  await expect(row("UC-09")).toHaveText(expect.stringContaining("P1"));
  await expect(row("UC-09")).toHaveText(expect.stringContaining("In Arbeit"));
  await expect(row("UC-09")).toHaveText(expect.stringContaining("In Review"));
  await expect(row("UC-12")).toHaveText(expect.stringContaining("Unterlagen offen"));
  await expectTaskContentContained();
  const initial = await width();
  await el("project-rail").$('button[aria-label="Seitennavigation einklappen"]').click();
  expect(await width()).toBeGreaterThan(initial + 100);

  await narrowKnowledgeLeaf();
  await expectTaskContentContained();
  await setTheme("dark");
  const geometry = await browser.execute(
    (entry: HTMLElement) => {
      const record = entry.getBoundingClientRect();
      const cells = [...entry.querySelectorAll("td")];
      const full = cells[0]?.getBoundingClientRect();
      const content = entry.closest<HTMLElement>('[data-testid="project-content"]');
      const leaf = entry.closest<HTMLElement>(".workspace-leaf");
      return {
        rowWidth: record.width,
        titleWidth: full?.width ?? 0,
        contentSpill: content ? content.scrollWidth - content.clientWidth : Infinity,
        leafWidth: leaf?.clientWidth ?? 0,
        metadataBelow: cells
          .slice(1)
          .every((cell) => cell.getBoundingClientRect().top >= (full?.bottom ?? Infinity)),
        labels: cells
          .slice(1)
          .map((cell) => cell.querySelector(".pe-overview-field-label")?.textContent?.trim()),
      };
    },
    await row("UC-09"),
  );
  expect(geometry.leafWidth).toBeGreaterThanOrEqual(380);
  expect(geometry.leafWidth).toBeLessThanOrEqual(391);
  expect(geometry.titleWidth).toBeGreaterThanOrEqual(geometry.rowWidth - 24);
  expect(geometry.contentSpill).toBeLessThanOrEqual(1);
  expect(geometry.metadataBelow).toBe(true);
  expect(geometry.labels).toEqual(["Priorität", "Backlog", "Lieferstand"]);
  await browser.execute((element: HTMLElement) => element.focus(), await title());
  await browser.keys("Enter");
  await expect(el("pbi-detail").$("h1")).toHaveText("Gefilterte Servicefälle exportieren");
  await back().click();
  await expect(title()).toBeFocused();

  await el("overview-foundations").$("summary").click();
  const prd = el("overview-foundations").$("button=Servicefälle übergeben");
  await expect(prd).toBeDisplayed();
  await prd.click();
  await expect(el("knowledge-note").$("h1")).toHaveText("Servicefälle übergeben");
  await el("project-record-return").click();
  await expect(prd).toBeFocused();
});
