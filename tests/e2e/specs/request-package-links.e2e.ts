import { createHash } from "node:crypto";
import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute } from "../../../src/application/feature-requests";
import type { StoredRequestPackage } from "../../../src/application/feature-requests";
import { newNoteText } from "../../../src/domain/notes";
import { customerFolder, customerProject, customerRequirement, vision } from "../knowledge-vault";
import { capturePrototypeDownload as captureDownload } from "../prototype-native";
import {
  changeFixtureFile,
  deliveryRequest,
  seedRequestDeliveryVault,
} from "../request-delivery-vault";
import { openView, ROOT, setViewRoute } from "../support";

const actor = "knowledge-33333333-3333-4333-8333-000000000010";
const actorLink = "[[AKT-01#Rolle und Ziel|zuständige Rolle]]";
const prdPath = customerFolder + "/PRD-03.md";
const negativeTargets = ["AKT-02", "JOB-19", "AKT-77", "AKT-99", "Produkte/Admin Console/PRD-03"];
const sourceText = `[[VIS-01|Vision]] und ${actorLink}. ${negativeTargets.map((target) => `[[${target}]]`).join(" ")}.`;
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

async function seedReferences() {
  const { git } = await seedRequestDeliveryVault(true);
  await changeFixtureFile(prdPath, "", sourceText);
  const repeated = ["Erste Rolle.md", "Zweite Rolle.md"].map((name, index) => ({
    path: `${customerFolder}/${name}`,
    text: newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        id: `knowledge-33333333-3333-4333-8333-00000000008${index}`,
        kind: "actor",
        actor_type: "human",
        project_id: customerProject,
        display_id: "AKT-77",
        title: name,
        approval: "approved",
      },
      "Akteur mit mehrdeutiger Kurz-ID.",
    ),
  }));
  await browser.executeObsidian(
    async ({ app }, job, duplicates) => {
      const source = app.vault.getFileByPath(job);
      if (!source) throw new Error("Missing the unapproved knowledge fixture");
      await app.fileManager.processFrontMatter(source, (fields: Record<string, unknown>) => {
        fields.approval = "draft";
      });
      await Promise.all(duplicates.map(({ path, text }) => app.vault.create(path, text)));
    },
    customerFolder + "/JOB-19.md",
    repeated,
  );
  git("add", "--", "PRD-03.md", "AKT-01.md", "JOB-19.md", "Erste Rolle.md", "Zweite Rolle.md");
  git("commit", "--quiet", "-m", "Reviewed PRD and directly cited knowledge");
  return git;
}

it("V18: packages the immutable reference to directly cited approved Knowledge without adding its text", async function () {
  this.timeout(90_000);
  const git = await seedReferences();
  const actorCommit = git("log", "-1", "--format=%H", "--", "AKT-01.md");
  expect(git("show", actorCommit + ":AKT-01.md")).toContain(actor);
  expect(git("show", actorCommit + ":PRD-03.md")).toContain(actorLink);
  expect(git("ls-files", "--", "AKT-02.md")).toBe("");

  await openView();
  await setViewRoute(
    featureRequestsRoute(customerProject, { requestId: deliveryRequest, tab: "gates" }),
  );
  await expect(el("request-release")).toBeEnabled({ wait: 15_000 });
  await el("request-release").click();
  await expect(el("request-state")).toHaveText("Freigegeben", { wait: 15_000 });
  await el("request-tab-package").click();
  const exported = await captureDownload(await el("request-export"));
  const { package: payload, checksum } = JSON.parse(exported.text) as StoredRequestPackage;
  expect(payload.attachments.some(({ id }) => id === actor)).toBe(false);
  expect(payload.attachments.find(({ id }) => id === customerRequirement)?.markdown).toContain(
    sourceText,
  );
  expect(createHash("sha256").update(JSON.stringify(payload)).digest("hex")).toBe(checksum?.value);
  expect(payload.links?.find(({ target }) => target === "VIS-01")?.artifact?.id).toBe(vision);
  expect(
    payload.links
      ?.filter(({ target }) => negativeTargets.includes(target))
      .map(({ target, artifact }) => [target, artifact]),
  ).toEqual(negativeTargets.map((target) => [target, undefined]));
  expect(payload.links?.find(({ target }) => target === "AKT-01")).toMatchObject({
    source: customerRequirement,
    anchor: "Rolle und Ziel",
    alias: "zuständige Rolle",
    artifact: { id: actor, commit: actorCommit },
  });
  await changeFixtureFile(customerFolder + "/AKT-01.md", "", "Neuer Text im aktuellen Akteur.");
  expect((await captureDownload(await el("request-export"))).bytes).toEqual(exported.bytes);
});
