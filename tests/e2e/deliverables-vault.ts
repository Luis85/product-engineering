import { browser } from "@wdio/globals";
import { newNoteText } from "../../src/domain/notes";
import { seedBacklogVault } from "./backlog-vault";
import { customerFolder, customerProject } from "./knowledge-vault";

export const plannedTitle = "Testkonzept für den Falllistenexport";
export const reviewTitle = "Architekturentscheidung zur Organisationsgrenze";
export const noteTitle = "Organisationsgrenze im Export";
export const adrIdentity = "knowledge-33333333-3333-4333-8333-000000000121";
export const adrPath = customerFolder + "/ADR-02.md";
const deliverableFolder = customerFolder + "/Deliverables";

export async function seedDeliverablesReference() {
  await seedBacklogVault();
  const records = [
    {
      id: "deliverable-33333333-3333-4333-8333-000000000122",
      display_id: "DEL-01",
      title: plannedTitle,
      outcome:
        "Das Team kann die gefilterte Liste und die Organisationsgrenze mit repräsentativen Beispielen prüfen.",
      template: "test-concept",
      status: "planned",
    },
    {
      id: "deliverable-33333333-3333-4333-8333-000000000123",
      display_id: "DEL-02",
      title: reviewTitle,
      outcome: "Die Entscheidung hält fest, welche Fälle jede Organisation weitergeben darf.",
      template: "adr",
      status: "in-review",
      knowledge_id: adrIdentity,
    },
  ].map((record) => ({
    path: `${deliverableFolder}/${record.display_id} ${record.id}.md`,
    text: newNoteText({
      schema: "product-engineering.deliverable/v1",
      project_id: customerProject,
      ...record,
    }),
  }));
  const note = newNoteText(
    {
      schema: "product-engineering.knowledge/v1",
      id: adrIdentity,
      project_id: customerProject,
      display_id: "ADR-02",
      title: noteTitle,
      kind: "adr",
      approval: "approved",
    },
    "## Entscheidung\n\nDer Export verwendet das gleiche serverseitige Berechtigungsmodell wie die Fallübersicht.",
  );
  await browser.executeObsidian(
    async ({ app }, folder, files) => {
      await app.vault.createFolder(folder);
      for (const { path, text } of files) await app.vault.create(path, text);
    },
    deliverableFolder,
    [...records, { path: adrPath, text: note }],
  );
}
