import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { projectKnowledgeRoute } from "../../../src/application/knowledge";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { fixtureAuthor, seedKnowledgeGitVault } from "../knowledge-git-vault";
import { customerProject, customerRequirement } from "../knowledge-vault";
import { openView, ROOT, setViewRoute, VIEW_TYPE } from "../support";

let repo: Awaited<ReturnType<typeof seedKnowledgeGitVault>>;

before(async () => {
  repo = await seedKnowledgeGitVault();
});

const button = (name: string) => browser.$(`${ROOT} [data-testid="${name}"]`);
const timeline = () => button("git-versions");

async function openHistory() {
  await openView();
  await setViewRoute(projectKnowledgeRoute(customerProject));
  await browser.$(`${ROOT} [data-knowledge-record="${customerRequirement}"]`).click();
  await button("knowledge-history-tab").click();
  await expect(timeline()).toBeDisplayed();
}

async function sizeLeaf(width: number) {
  await browser.executeObsidian(
    ({ app }, type, value) => {
      const pane = app.workspace
        .getLeavesOfType(type)[0]
        ?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
      if (!pane) throw new Error("Missing Git History leaf");
      pane.style.flex = `0 0 ${value}px`;
      pane.style.width = `${value}px`;
    },
    VIEW_TYPE,
    width,
  );
}

function timelineGeometry() {
  return browser.execute((scope) => {
    const panel = document
      .querySelector(scope)
      ?.querySelector<HTMLElement>('[data-testid="git-versions"]');
    const list = panel?.querySelector<HTMLOListElement>("ol");
    const leaf = panel?.closest(".workspace-leaf");
    if (!panel || !list || !leaf) throw new Error("Missing revision timeline");
    const viewport = list.getBoundingClientRect();
    const limit = {
      right: viewport.left + list.clientWidth,
      bottom: viewport.top + list.clientHeight,
    };
    return {
      width: leaf.getBoundingClientRect().width,
      horizontalOverflow: list.scrollWidth - list.clientWidth,
      atOrigin: list.scrollTop === 0 && list.scrollLeft === 0,
      rows: Array.from(list.querySelectorAll<HTMLButtonElement>("li button"), (card) => {
        const bounds = card.getBoundingClientRect();
        const metadata = Array.from(
          card.querySelectorAll<HTMLElement>("strong, small, time, code"),
        );
        return {
          oid: card.dataset.gitOid,
          author: card.querySelector("small")?.textContent?.trim().split(" · ")[0],
          date: card.querySelector("time")?.getAttribute("datetime"),
          shortHash: card.querySelector("code")?.textContent?.trim(),
          horizontalOverflow: card.scrollWidth - card.clientWidth,
          verticalOverflow: card.scrollHeight - card.clientHeight,
          insideList: bounds.left >= viewport.left - 1 && bounds.right <= limit.right + 1,
          metadataInside: metadata.map((field) => {
            const box = field.getBoundingClientRect();
            return (
              Boolean(field.textContent?.trim()) &&
              box.height > 0 &&
              box.left >= bounds.left - 1 &&
              box.right <= bounds.right + 1 &&
              box.top >= bounds.top - 1 &&
              box.bottom <= Math.min(bounds.bottom, limit.bottom) + 1
            );
          }),
        };
      }),
    };
  }, ROOT);
}

async function checkTimeline(width: number, oids: readonly string[]) {
  await sizeLeaf(width);
  await browser.waitUntil(async () => (await timelineGeometry()).width === width);
  await expect(timeline().$$("li button")).toBeElementsArrayOfSize(oids.length);
  expect(await timelineGeometry()).toEqual({
    width,
    atOrigin: true,
    horizontalOverflow: 0,
    rows: oids.map((oid) => ({
      oid,
      author: fixtureAuthor,
      date: repo.git("show", "-s", "--format=%aI", oid).toString().trim(),
      shortHash: oid.slice(0, 8),
      horizontalOverflow: 0,
      verticalOverflow: 0,
      insideList: true,
      metadataInside: [true, true, true, true],
    })),
  });
}

it("shows complete revision metadata at 1440, 860 and 390 pixels with one or two real revisions", async () => {
  await openHistory();
  await narrowKnowledgeLeaf();
  const widths = [1440, 860, 390];
  repo.git("update-ref", "HEAD", repo.initial, repo.second);
  try {
    await button("git-working").click();
    for (const width of widths) await checkTimeline(width, [repo.initial]);
  } finally {
    repo.git("update-ref", "HEAD", repo.second, repo.initial);
  }

  await button("git-working").click();
  for (const width of widths) await checkTimeline(width, [repo.second, repo.initial]);
});
