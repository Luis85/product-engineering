import { browser } from "@wdio/globals";
import { Buffer } from "node:buffer";
import { newNoteText } from "../../src/domain/notes";
import {
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
  seedKnowledgeVault,
  vision,
} from "./knowledge-vault";
import { VIEW_TYPE } from "./support";

export const jobPath = customerFolder + "/JOB-12.md";
export const prdPath = customerFolder + "/PRD-03.md";
export const entity = "knowledge-33333333-3333-4333-8333-000000000039";
export const image = "Quellen/B/Skizze.png";
export const guide = "Quellen/B/Handbuch.md";
export const protectedLine = "custom_values: [North, South] # Beibehalten";
export const jobTitle = "Offene Fälle verlässlich übergeben";
export const jobMarkdown = "## Übergabe\r\n\r\nOffene Fälle brauchen ausgewählte Hilfe.\r\n";
const pixel =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=";

function record(id: string, kind: string, displayId: string, title: string, body: string) {
  return newNoteText(
    {
      schema: "product-engineering.knowledge/v1",
      id,
      project_id: customerProject,
      kind,
      display_id: displayId,
      title,
      approval: "approved",
    },
    "\n" + body,
  );
}

export async function seedKnowledgeDetailVault() {
  await seedKnowledgeVault();
  const job = record(jobOne, "jtbd", "JOB-12", jobTitle, jobMarkdown.replaceAll("\r\n", "\n"))
    .replace(
      "\napproval: approved\n",
      "\napproval: approved # Fachentscheidung\n" + protectedLine + "\n",
    )
    .replaceAll("\n", "\r\n");
  const fixtures = [
    [jobPath, job],
    [
      prdPath,
      record(
        customerRequirement,
        "prd",
        "PRD-03",
        "Servicefälle übergeben",
        "## Problem\n",
      ).replace("approval: approved", "approval: approved\nrequirement_id: REQ-18"),
    ],
    [
      customerFolder + "/VIS-01.md",
      record(vision, "vision", "VIS-01", "Produktvision Kundenportal", "## Vision\n"),
    ],
    [
      customerFolder + "/ENT-01.md",
      record(entity, "entity", "ENT-01", "Organisation", "## Definition\n"),
    ],
    ["Quellen/A/Handbuch.md", "## Andere Quelle\n"],
    [guide, "## Fundstelle\n\nNachweis der Übergabe.\n"],
    ["Quellen/B/Unsicher.html", "<script>document.body.dataset.v04Untrusted = 'ran'</script>"],
  ];
  await browser.executeObsidian(
    async ({ app }, entries, bytes, imagePath) => {
      for (const folder of ["Quellen", "Quellen/A", "Quellen/B"])
        await app.vault.createFolder(folder);
      for (const [path, text] of entries) {
        if (!path || text === undefined) continue;
        const file = app.vault.getFileByPath(path);
        if (file) await app.vault.modify(file, text);
        else await app.vault.create(path, text);
      }
      await app.vault.createBinary("Quellen/A/Skizze.png", Uint8Array.from(bytes).buffer);
      await app.vault.createBinary(imagePath, Uint8Array.from(bytes).buffer);
    },
    fixtures,
    [...Buffer.from(pixel, "base64")],
    image,
  );
}

export async function narrowKnowledgeLeaf() {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 640,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    const pane = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
    if (!leaf || !pane) throw new Error("Missing split leaf");
    app.workspace.getLeaf("split", "vertical");
    await app.workspace.revealLeaf(leaf);
    pane.style.flex = "0 0 390px";
    pane.style.width = "390px";
  }, VIEW_TYPE);
}
