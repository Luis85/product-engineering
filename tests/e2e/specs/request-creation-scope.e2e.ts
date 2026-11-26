import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import { newNoteText } from "../../../src/domain/notes";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminFolder, adminProject, customerProject } from "../knowledge-vault";
import { pbiTitle } from "../pbi-vault";
import { requestFolder, seedRequestsVault } from "../request-vault";
import { openView, ROOT, setViewRoute } from "../support";

const emptyProject = "project-33333333-3333-4333-8333-000000000003";
const emptyFolder = "Produkte/Empty project";
const adminRequest = "feature-request-33333333-3333-4333-8333-000000000079";
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = (id: string) => browser.$(`${ROOT} [data-request-row="${id}"]`);
const field = (name: string) => browser.$(`${ROOT} [data-testid=request-form] [name="${name}"]`);

async function seedIsolatedProjects() {
  await browser.executeObsidian(
    async ({ app }, folder, entries) => {
      await app.vault.createFolder(folder);
      for (const { path, text } of entries) await app.vault.create(path, text);
    },
    emptyFolder,
    [
      {
        path: emptyFolder + "/Project.md",
        text: newNoteText({
          schema: "product-engineering.project/v1",
          id: emptyProject,
          name: "Empty project",
          description: "Project with an empty backlog",
          repository: "produktteam/empty",
          branch: "main",
          backlog_base: "Backlog.base",
        }),
      },
      {
        path: emptyFolder + "/Backlog.base",
        text: `filters: 'note.project_id == "${emptyProject}"'\nviews:\n  - type: table\n    name: Empty Backlog\n`,
      },
      {
        path: adminFolder + "/FR-024.md",
        text: newNoteText({
          schema: "product-engineering.feature-request/v1",
          id: adminRequest,
          project_id: adminProject,
          display_id: "FR-024",
          pbi_id: "UC-09",
          title: "Admin-Export",
          scope: "Nur Daten aus der Admin Console.",
          sequence: 24,
          revision: 3,
          state: "accepted",
        }),
      },
    ],
  );
}

async function create(scope: string) {
  await el("request-create").click();
  const select = field("pbiId");
  await expect(select).toBeDisplayed();
  await select.selectByAttribute("value", "UC-09");
  await field("title").setValue("");
  await field("scope").setValue(scope);
  await el("request-save").click();
  await expect(el("request-scope")).toHaveText(scope);
  await expect(el("request-detail")).toHaveText(expect.stringContaining(pbiTitle));
}

it("V17: creates distinct scopes on one PBI, in a narrow layout, and isolates same short IDs and empty projects", async () => {
  await seedRequestsVault();
  await seedIsolatedProjects();
  await openView();
  await setViewRoute(featureRequestsRoute(emptyProject));
  await expect(el("request-empty")).toHaveText(
    "Sobald du aus einem PBI einen Auftrag erstellst, erscheint er hier.",
  );
  await el("request-create").click();
  await expect(el("request-form")).toHaveText(
    expect.stringContaining("Ein Feature Request braucht ein PBI."),
  );
  await el("request-create-pbi").click();
  await expect(el("backlog-form")).toBeDisplayed();
  await expect(browser.$(`${ROOT} [data-testid=backlog-form] input[name=title]`)).toBeFocused();
  await el("backlog-cancel").click();
  await expect(el("request-create")).toBeFocused();

  await setViewRoute(featureRequestsRoute(adminProject));
  await expect(row("FR-024")).toHaveText(expect.stringContaining("Admin-Export"));
  await expect(row("FR-024")).toHaveText(expect.stringContaining("UC-09"));
  await expect(row("FR-024")).not.toHaveText(expect.stringContaining("Servicefälle"));
  await setViewRoute(featureRequestsRoute(customerProject, { requestId: adminRequest }));
  await expect(el("request-empty")).toHaveText(
    "Dieser Feature Request ist in diesem Projekt nicht verfügbar.",
  );

  await setViewRoute(featureRequestsRoute(customerProject));
  await expect(row("FR-024")).toHaveText(expect.stringContaining("CSV-Export · Servicefälle"));
  await el("request-create").click();
  await el("request-save").click();
  await expect(field("pbiId")).toBeFocused();
  await expect(el("request-form")).toHaveText(
    expect.stringContaining("Wähle ein verfügbares PBI aus diesem Projekt."),
  );
  await browser.keys("Escape");
  await expect(el("request-create")).toBeFocused();
  await create("Export der bestätigten Auswahl");
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-025 · Revision 1"));
  await el("request-return").click();
  await create("Export der archivierten Auswahl");
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-026 · Revision 1"));
  await el("request-return").click();
  await expect(row("FR-025")).toBeDisplayed();
  await expect(row("FR-026")).toBeDisplayed();

  await setViewRoute(backlogBoardRoute(customerProject));
  await narrowKnowledgeLeaf();
  const card = browser.$(`${ROOT} [data-board-stage="In Development"] [data-board-card="UC-09"]`);
  await expect(card).toBeDisplayed();
  await expect(card.$("[data-request-link=FR-026]")).toBeDisplayed();
  await expect(card).toHaveText(expect.stringContaining("Entwurf"));
  await card.$('[data-testid="pbi-request-links"] > details > summary').click();
  await expect(card.$("[data-request-link=FR-025]")).toBeDisplayed();
  await expect(card.$("[data-request-link=FR-024]")).toBeDisplayed();
  const scope = await browser.executeObsidian(
    ({ app }, folder) =>
      app.vault.getMarkdownFiles().filter(({ path }) => path.startsWith(folder + "/")).length,
    requestFolder,
  );
  expect(scope).toBe(3);

  await browser.executeObsidian(
    async ({ app }, entries) => {
      for (const { path, text } of entries) await app.vault.create(path, text);
    },
    [
      {
        path: requestFolder + "/FR-030.md",
        text: newNoteText({
          schema: "product-engineering.feature-request/v1",
          id: "feature-request-33333333-3333-4333-8333-000000000030",
          project_id: customerProject,
          display_id: "FR-030",
          pbi_id: "UC-09",
          title: "Abgenommene Teilmenge",
          scope: "Nur zuletzt bestätigte Fälle.",
          sequence: 30,
          revision: 1,
          state: "accepted",
        }),
      },
      {
        path: requestFolder + "/FR-031.md",
        text: newNoteText({
          schema: "product-engineering.feature-request/v1",
          id: "feature-request-33333333-3333-4333-8333-000000000031",
          project_id: customerProject,
          display_id: "FR-031",
          pbi_id: "UC-88",
          title: "Fehlendes PBI",
          scope: "Die frühere Auswahl erneut prüfen.",
          sequence: 31,
          revision: 1,
          state: "draft",
        }),
      },
    ],
  );
  const historyLink = card.$("[data-request-link=FR-030]");
  await expect(historyLink).toBeDisplayed();
  await historyLink.click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("Abgenommen"));
  await el("request-return").click();
  const returnedHistory = browser.$(`${ROOT} [data-board-card=UC-09] [data-request-link=FR-030]`);
  await expect(returnedHistory).toBeFocused();
  await setViewRoute(featureRequestsRoute(customerProject));
  await expect(row("FR-031")).toHaveText(
    expect.stringContaining("UC-88 · Das PBI ist in diesem Projekt nicht verfügbar."),
  );
  await row("FR-031").$("[data-testid=request-row-title]").click();
  await expect(el("request-detail")).toHaveText(
    expect.stringContaining("Das PBI ist in diesem Projekt nicht verfügbar."),
  );
  await expect(el("request-detail-pbi")).not.toExist();
});
