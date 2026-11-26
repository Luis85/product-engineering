import { browser } from "@wdio/globals";
import { newNoteText } from "../../src/domain/notes";
import {
  adminFolder,
  adminProject,
  customerFolder,
  customerProject,
  seedKnowledgeVault,
} from "./knowledge-vault";

export const work = customerFolder + "/Backlog";
export const existingBase = customerFolder + "/Backlog.base";
export const exportPath = work + "/Gefilterte Servicefälle exportieren.md";
export const reviewPath = work + "/Freigabe dokumentieren.md";
export const epicPath = work + "/Kundenservice.md";
export const featurePath = work + "/Servicefälle verwalten.md";
export const backlogEntity = "knowledge-33333333-3333-4333-8333-000000000101";

export const sentinel = 'protected: "exact bytes and # text" # external comment\n';
export const exportBody = "\n## Historie\n\n[[Servicefälle verwalten|Quelle]] bleibt erhalten.\n";
export const secondText =
  '---\ntype: PBI\nparent: "[[Servicefälle verwalten]]"\norder: 400\nDeliveryState: Open\n' +
  sentinel +
  "---\n\n## Separater Eintrag\n";

export async function seedBacklogVault() {
  await seedKnowledgeVault();
  const note = (
    path: string,
    type: string,
    id: string,
    order: number,
    body: string,
    parent?: string,
  ) => ({
    path,
    text: newNoteText(
      { type, "pe-id": id, order, ...(parent && { parent }), project_id: customerProject },
      body,
    ),
  });
  await browser.executeObsidian(
    async ({ app }, folder, entries) => {
      await app.vault.createFolder(folder);
      for (const { path, text } of entries) await app.vault.create(path, text);
    },
    work,
    [
      {
        path: existingBase,
        text: `# existing setup\nfilters:\n  and:\n    - 'file.inFolder("${work}")'\n    - 'file.ext == "md"'\nviews:\n  - type: table\n    name: Native status table\n    order:\n      - file.name\n      - note.DeliveryState\n  - type: product-backlog\n    name: Product Backlog mapping\n    homeFolder: ${work}\n    stateProperty: note.DeliveryState\n    stateValues: Backlog, Open, Active, Review, Done\n    assigneeProperty: note.Steward\n    priorityProperty: note.Urgency\n    priorityValues: P1, P2, P3\n`,
      },
      note(epicPath, "Epic", "EP-01", 100, "\n## Kundenportal\n"),
      {
        path: featurePath,
        text: newNoteText(
          {
            schema: "product-engineering.backlog/v1",
            id: "backlog-33333333-3333-4333-8333-000000000011",
            project_id: customerProject,
            type: "Feature",
            "pe-id": "FE-01",
            order: 200,
            parent: "[[Kundenservice]]",
          },
          "\n## Servicefälle\n",
        ),
      },
      {
        path: customerFolder + "/Organisation.md",
        text: newNoteText(
          {
            schema: "product-engineering.knowledge/v1",
            id: backlogEntity,
            project_id: customerProject,
            kind: "entity",
            display_id: "ENT-01",
            title: "Organisation",
            approval: "draft",
            domain_scope: [{ kind: "item", id: "FE-01" }],
          },
          "\n## Geschäftskunde\n",
        ),
      },
      note(work + "/Doppelter Eintrag A.md", "Feature", "FE-99", 450, "", "[[Kundenservice]]"),
      note(work + "/Doppelter Eintrag B.md", "Feature", "FE-99", 500, "", "[[Kundenservice]]"),
      {
        path: exportPath,
        text:
          '---\ntype: PBI\nparent: "[[Servicefälle verwalten]]"\norder: 300\npbl-id: 008\nDeliveryState: Active\nSteward: Mara König\nUrgency: P1\n' +
          sentinel +
          "---\n" +
          exportBody,
      },
      { path: reviewPath, text: secondText },
      {
        path: adminFolder + "/Backlog.base",
        text: `filters: 'note.project_id == "${adminProject}"'\nviews:\n  - type: table\n    name: Admin Backlog\n`,
      },
      {
        path: adminFolder + "/Admin service.md",
        text: newNoteText(
          { type: "PBI", "pe-id": "UC-09", project_id: adminProject, order: 350 },
          "\n## Admin only\n",
        ),
      },
      {
        path: adminFolder + "/Admin epic.md",
        text: newNoteText(
          { type: "Epic", "pe-id": "EP-01", project_id: adminProject, order: 100 },
          "\n## Admin only\n",
        ),
      },
    ],
  );
}
