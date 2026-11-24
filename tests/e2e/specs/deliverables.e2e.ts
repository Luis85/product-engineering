import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { seedBacklogVault } from "../backlog-vault";
import {
  adminRequirement,
  customerFolder,
  customerProject,
  mara,
  vision,
} from "../knowledge-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";

const el = (test: string) => browser.$(`${ROOT} [data-testid="${test}"]`);
const route = { name: "project-backlog", projectId: customerProject, tab: "deliverables" };
const second = () => el("deliverables").$("[data-deliverable-id]:nth-child(2)");

const pathsContaining = (prefix: string) =>
  browser.executeObsidian(
    ({ app }, folder, match) =>
      app.vault
        .getMarkdownFiles()
        .filter(({ path }) => path.startsWith(folder + "/") && path.includes(match))
        .map(({ path }) => path)
        .toSorted(),
    customerFolder,
    prefix,
  );

before(() => seedBacklogVault());

it("opens the fourth Backlog tab by keyboard and creates an unassigned deliverable in Geplant", async () => {
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  const tab = el("backlog-tab-deliverables");
  await expect(tab).toHaveText("Deliverables");
  await browser.execute((button: HTMLElement) => button.focus(), await tab);
  await browser.keys("Enter");
  expect(await readViewRoute()).toEqual(route);
  await expect(el("deliverable-empty")).toHaveText(
    "In diesem Projekt sind noch keine Deliverables geplant.",
  );
  await el("deliverable-create").click();
  await expect(el("deliverable-owner")).toHaveValue("");
  await expect(el("deliverable-template")).toHaveValue("");
  await el("deliverable-title").setValue("Betriebshandbuch");
  await el("deliverable-outcome").setValue("Ein nachvollziehbarer Bereitschaftsdienst");
  await el("deliverable-template").selectByVisibleText("Betriebskonzept");
  await browser.execute(
    (element: HTMLElement) => {
      (element as HTMLInputElement).value = "2027-04-30";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    },
    await el("deliverable-due"),
  );
  await el("deliverable-save").click();
  await expect(el("deliverable-row-title")).toHaveText("Betriebshandbuch");
  await expect(el("deliverable-row-status")).toHaveValue("planned");
  await expect(el("deliverables").$('time[datetime="2027-04-30"]')).toBeDisplayed();
});

it("links an existing scoped note and focuses incompatible or stale selections for repair", async () => {
  await setViewRoute(route);
  const link = el("deliverable-link-note");
  await expect(link).toBeDisplayed();
  await link.click();
  const field = el("deliverable-knowledge");
  await expect(field).toBeFocused();
  await expect(field.$(`option[value="${adminRequirement}"]`)).not.toExist();
  await browser.execute(
    (element: HTMLElement, foreign) => {
      const select = element as HTMLSelectElement;
      const option = select.ownerDocument.createElement("option");
      option.value = foreign;
      option.text = "Stale project note";
      select.add(option);
      select.value = foreign;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    await field,
    adminRequirement,
  );
  await el("deliverable-save").click();
  await expect(field).toBeFocused();
  await expect(el("deliverable-issue")).toHaveText(expect.stringContaining("gewünschten Vorlage"));
  await el("deliverable-template").selectByAttribute("value", "");
  await field.selectByAttribute("value", vision);
  await el("deliverable-template").selectByAttribute("value", "operations-concept");
  await el("deliverable-save").click();
  await expect(field).toBeFocused();
  await expect(el("deliverable-issue")).toBeDisplayed();
  await el("deliverable-template").selectByAttribute("value", "vision");
  await el("deliverable-owner").selectByAttribute("value", mara);
  await el("deliverable-save").click();
  await expect(el("deliverable-open-note")).toHaveText("Durchgängiger Kundenservice");
  await expect(el("deliverable-row-owner")).toHaveText("Mara König");
});

it("recovers a native link refusal using the same OPS note and opens its real editor and backlink", async () => {
  await el("deliverable-create").click();
  await el("deliverable-title").setValue("Schichtübergabe");
  await el("deliverable-outcome").setValue("Die nächste Schicht kann Störungen übernehmen.");
  await el("deliverable-template").selectByAttribute("value", "operations-concept");
  await el("deliverable-save").click();
  const row = second();
  await expect(row.$('[data-testid="deliverable-row-title"]')).toHaveText("Schichtübergabe");
  const createNote = row.$('[data-testid="deliverable-create-note"]');
  await expect(createNote).toBeDisplayed();
  await createNote.click();
  const form = browser.$(`${ROOT} [role="dialog"] form`);
  await expect(form.$('[name="kind"]')).toHaveValue("operations-concept");
  await expect(form.$('[name="owner_id"]')).toHaveValue("");
  await form.$('[name="title"]').setValue("Dienstbereitschaft für das Portal");
  await browser.executeObsidian(({ app }) => {
    const process = app.vault.process.bind(app.vault);
    app.vault.process = async (file, ...args) => {
      if (
        file.path.includes("/Deliverables/") &&
        app.vault
          .getMarkdownFiles()
          .some(({ basename }) => basename === "Dienstbereitschaft für das Portal")
      ) {
        app.vault.process = process;
        throw new Error("Controlled second-file write refusal");
      }
      return process(file, ...args);
    };
  });
  const submit = form.$('button[type="submit"]');
  await submit.click();
  await expect(form.$('[role="alert"]')).toBeDisplayed();
  const deliverableId = await row.getAttribute("data-deliverable-id");
  if (!deliverableId) throw new Error("Missing canonical deliverable identity");
  const [tracking] = await pathsContaining(deliverableId);
  if (!tracking) throw new Error("Missing canonical deliverable");
  const partial = await readVaultText(tracking);
  expect(partial).toContain("pending_knowledge_id: knowledge-");
  await expect(form.$('[role="alert"]')).toHaveText(
    expect.stringContaining("Die Notiz konnte nicht gespeichert werden"),
  );
  await expect(form.$('[name="title"]')).toHaveValue("Dienstbereitschaft für das Portal");
  const candidates = await pathsContaining("Dienstbereitschaft");
  const [path] = candidates;
  if (!path) {
    throw new Error(
      `Missing durable handoff: row ${deliverableId}, candidates ${candidates.join(", ")}`,
    );
  }
  const firstWrite = await readVaultText(path);
  expect(firstWrite).toContain("display_id: OPS-01");
  expect(firstWrite).toContain("deliverable_id: " + deliverableId);
  expect(firstWrite).not.toContain("owner_id:");
  const outside =
    (firstWrite ?? "").replace("---\n", "---\ncustom_handoff: preserve\n") +
    "\n## Außerhalb ergänzt\n";
  await browser.executeObsidian(
    async ({ app }, notePath, content) => {
      const note = app.vault.getFileByPath(notePath);
      if (!note) throw new Error("Missing prepared note");
      await app.vault.modify(note, content);
    },
    path,
    outside,
  );
  await submit.click();
  await expect(browser.$(`${ROOT} textarea[name="markdown"]`)).toBeDisplayed();
  expect(await pathsContaining("Dienstbereitschaft")).toEqual([path]);
  expect(await readVaultText(path)).toBe(outside);
  expect(await readVaultText(tracking)).not.toContain("pending_knowledge_id:");
  await el("knowledge-references-tab").click();
  await expect(el("knowledge-deliverable-backlink")).toHaveText("DEL-02 · Schichtübergabe");
  await el("knowledge-deliverable-backlink").click();
  await expect(el("deliverable-title")).toHaveValue("Schichtübergabe");
  await expect(el("deliverable-owner")).toHaveValue("");
  await browser.keys("Escape");
  await expect(row.$('[data-testid="deliverable-open-note"]')).toHaveText(
    "Dienstbereitschaft für das Portal",
  );
});
