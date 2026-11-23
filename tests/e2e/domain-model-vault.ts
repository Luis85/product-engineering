import { browser } from "@wdio/globals";
import type { EntityEdge } from "../../src/domain/knowledge";
import { newNoteText } from "../../src/domain/notes";
import {
  adminFolder,
  adminProject,
  customerFolder,
  customerProject,
  customerRequirement,
  seedKnowledgeVault,
} from "./knowledge-vault";

export const organisation = "knowledge-33333333-3333-4333-8333-000000000101";
export const serviceCase = "knowledge-33333333-3333-4333-8333-000000000102";
export const release = "knowledge-33333333-3333-4333-8333-000000000103";
export const adminEntity = "knowledge-33333333-3333-4333-8333-000000000104";
export const organisationPath = customerFolder + "/Organisation.md";

const reports = {
  id: "REL-01",
  target: serviceCase,
  verb: "meldet",
  sourceCardinality: "1",
  targetCardinality: "0..*",
  rule: "Nur berechtigte Personen dürfen Servicefälle melden.",
} as const satisfies EntityEdge;

export async function seedDomainModelVault(scopeAssigned = false) {
  await seedKnowledgeVault();
  const fixtures = [
    [
      customerFolder,
      customerProject,
      organisation,
      "ENT-01",
      "Organisation",
      "Eine Organisation ist ein Geschäftskunde mit eigener Kundennummer.",
      {
        approval: "approved",
        domain_attributes: [{ name: "Kundennummer", description: "Eindeutige interne Referenz" }],
        domain_edges: [
          reports,
          { ...reports, id: "REL-02", verb: "prüft", sourceCardinality: "0..1" },
          {
            ...reports,
            id: "REL-04",
            target: organisation,
            verb: "vertritt",
            targetCardinality: "1..*",
          },
        ],
        ...(scopeAssigned && { domain_scope: [{ kind: "prd", id: customerRequirement }] }),
      },
    ],
    [
      customerFolder,
      customerProject,
      serviceCase,
      "ENT-02",
      "Servicefall",
      "Ein Servicefall hält die Anfrage und ihren Bearbeitungsstand fest.",
      {
        domain_edges: [
          { ...reports, id: "REL-03", target: organisation, verb: "gehört zu" },
          { ...reports, id: "REL-05", target: release, verb: "erfordert" },
        ],
      },
    ],
    [
      customerFolder,
      customerProject,
      release,
      "ENT-03",
      "Freigabe",
      "Eine Freigabe dokumentiert die Zustimmung zum nächsten Schritt.",
      {},
    ],
    [
      adminFolder,
      adminProject,
      adminEntity,
      "ENT-01",
      "Administrationskonto",
      "Ein Administrationskonto verwaltet Zugriffsberechtigungen.",
      { domain_edges: [{ ...reports, target: adminEntity, verb: "verwaltet" }] },
    ],
  ] as const;
  const notes = fixtures.map(([folder, project_id, id, display_id, title, body, fields]) => ({
    path: folder + "/" + title + ".md",
    text: newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        kind: "entity",
        approval: "draft",
        project_id,
        id,
        display_id,
        title,
        ...fields,
      },
      `\n${body}\n`,
    ),
  }));
  await browser.executeObsidian(async ({ app }, entries) => {
    for (const { path, text } of entries) await app.vault.create(path, text);
  }, notes);
}
