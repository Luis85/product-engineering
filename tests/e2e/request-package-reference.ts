import { browser } from "@wdio/globals";
import { canonicalRequestJson } from "../../src/application/feature-requests";
import type { RequestPackage } from "../../src/application/feature-requests";
import { customerProject, customerRequirement, jobOne, vision } from "./knowledge-vault";
import { deliveryPath, deliveryRequest } from "./request-delivery-vault";
import { seedRequestsVault } from "./request-vault";

const title = "CSV-Export · Servicefälle";
const scope = "Gesamter Use-Case";
const commit = (short: string) => short.padEnd(40, "0");
const attachments = [
  [
    vision,
    "VIS-01",
    "vision",
    "Produktvision Kundenportal",
    2,
    "d7cbfdc",
    "## Vision\nService-Koordinatorinnen behalten offene Fälle im Blick und übergeben sie ohne manuelle Listen zwischen Teams.",
  ],
  [
    "knowledge-33333333-3333-4333-8333-000000000041",
    "RES-14",
    "research",
    "Interview zur Wochenübergabe",
    1,
    "bac5711",
    "## Beobachteter Ablauf\nDrei Koordinatorinnen markieren offene Fälle im Portal und kopieren die Liste in eine Tabelle.",
  ],
  [
    jobOne,
    "JOB-12",
    "jtbd",
    "Offene Fälle verlässlich übergeben",
    2,
    "0212abf",
    "## Situation\nKurz vor der Wochenübergabe liegen offene Fälle auf mehreren Ergebnisseiten verteilt.",
  ],
  [
    customerRequirement,
    "PRD-03",
    "prd",
    "Servicefälle übergeben",
    3,
    "501ad1e",
    "## REQ-18 · Ergebnis\nBerechtigte Koordinatorinnen können alle für sie sichtbaren gefilterten Servicefälle vollständig weitergeben.",
  ],
  [
    "knowledge-33333333-3333-4333-8333-000000000042",
    "ADR-02",
    "adr",
    "Organisationsgrenze im Export",
    1,
    "d551ba6",
    "## Entscheidung\nDer Export verwendet das gleiche serverseitige Berechtigungsmodell wie die Fallübersicht.",
  ],
] as const;

export async function seedLegacyRequestPackage() {
  await seedRequestsVault();
  const data: RequestPackage = {
    schemaVersion: 1,
    request: {
      projectId: customerProject,
      id: deliveryRequest,
      displayId: "FR-024",
      revision: 2,
      title,
    },
    destination: { repository: "produktteam/kundenportal", branch: "main", dataClass: "internal" },
    scope,
    useCase: {
      id: "UC-09",
      displayId: "UC-09",
      title: "Gefilterte Servicefälle exportieren",
      markdown:
        "## Akteur und Ziel\nEine berechtigte Service-Koordinatorin gibt die gefilterte Übersicht als CSV weiter.",
      revision: 3,
      owner: "Jonas Berg",
      commit: commit("b195cda"),
      criteria: [
        {
          id: "AC-01",
          text: "Alle sichtbaren Treffer exportieren",
          scenario_id: "SC-091",
          scenario_name: "Alle sichtbaren Treffer exportieren",
          given: "eine berechtigte Koordinatorin 27 gefilterte Fälle sieht",
          when: "sie die Treffer als CSV exportiert",
          then_step: "die CSV alle 27 gefilterten Fälle enthält",
        },
        {
          id: "AC-02",
          text: "Organisationsgrenze einhalten",
          scenario_id: "SC-092",
          scenario_name: "Organisationsgrenze einhalten",
          given: "passende Fälle in zwei Organisationen vorliegen",
          when: "die Koordinatorin die Treffer exportiert",
          then_step: "die CSV nur Fälle ihrer Organisation enthält",
        },
      ],
    },
    requirement: {
      id: "REQ-18",
      artifactId: customerRequirement,
      anchor: "REQ-18",
      commit: commit("501ad1e"),
    },
    gherkin:
      "# language: de\nFunktionalität: Gefilterte Servicefälle exportieren\n\n  @UC-09 @AC-01 @SC-091\n  Szenario: Alle sichtbaren Treffer exportieren\n",
    attachments: attachments.map(
      ([id, displayId, kind, artifactTitle, revision, sha, markdown]) => ({
        id,
        displayId,
        kind,
        revision,
        title: artifactTitle,
        commit: commit(sha),
        markdown,
      }),
    ),
  };
  const exportJson = canonicalRequestJson({ package: data });
  await browser.executeObsidian(
    async ({ app }, path, payload, legacyScope) => {
      const note = app.vault.getFileByPath(path);
      if (!note) throw new Error("Missing packaged request fixture");
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        fields.scope = legacyScope;
        fields.delivery_data = payload;
      });
    },
    deliveryPath,
    canonicalRequestJson({ current: { exportJson, events: [] }, history: [] }),
    scope,
  );
  return exportJson;
}
