import { expect, it } from "vitest";
import { nfrCatalogRoute, pbiDetailRoute } from "../../../../src/application/backlog";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { eventually } from "../../../support/wait";
import type { testRuntime } from "../../../support/runtime";
import { find, first, withProject } from "./knowledge-fixture";
import {
  folder,
  gone,
  map,
  mapFields,
  mapPath,
  panel,
  press,
  shown,
  testId,
  text,
} from "./story-map-ui-fixture";

const prd = "knowledge-33333333-3333-4333-8333-000000000831";
const prior = "knowledge-33333333-3333-4333-8333-000000000832";
const viaItem = "knowledge-33333333-3333-4333-8333-000000000833";
const direct = "knowledge-33333333-3333-4333-8333-000000000834";
const nfr = "nfr-33333333-3333-4333-8333-000000000835";
const childNfr = "nfr-33333333-3333-4333-8333-000000000836";
const item = "backlog-33333333-3333-4333-8333-000000000837";
const mapRoute = storyMapsRoute(first, map);
const nfrContext = testId("story-map-context-nfrs");
const entityContext = testId("story-map-context-entities");
const entityPanel = testId("domain-scope");
const explicitEntity = `[data-domain-scope-link="${direct}"]`;
const entityPath = folder + "/ENT-03.md";
const origin = { section: "storymaps", reference: { kind: "story-map", recordId: map } };

async function seed(host: ReturnType<typeof testRuntime>) {
  const run = host.runtime.runPromise.bind(host.runtime);
  const knowledge = [
    [prd, "prd", "PRD-01", "Handover expectations", []],
    [prior, "entity", "ENT-01", "Shift", [{ kind: "prd", id: prd }]],
    [viaItem, "entity", "ENT-02", "Queue", [{ kind: "item", id: "UC-01" }]],
    [direct, "entity", "ENT-03", "Notes", []],
  ] as const;
  await Promise.all(
    knowledge.map(([id, kind, display_id, title, scope]) =>
      run(
        host.notes.seed(
          `${folder}/${display_id}.md`,
          {
            schema: "product-engineering.knowledge/v1",
            project_id: first,
            id,
            kind,
            display_id,
            title,
            approval: "draft",
            ...(kind === "entity" && { domain_scope: scope }),
          },
          "\nDefinition of " + title,
        ),
      ),
    ),
  );
  await run(
    host.notes.seed(mapPath, {
      ...mapFields(),
      prd_id: prd,
      activities: [{ id: "ACT-01", title: "Review work" }],
      steps: [{ id: "STEP-01", activityId: "ACT-01", title: "Review the next case" }],
      cards: [{ id: "CARD-01", stepId: "STEP-01", title: "Review the next case" }],
      card_links: [{ kind: "item", projectId: first, cardId: "CARD-01", recordId: "UC-01" }],
    }),
  );
  await run(
    host.notes.seed(folder + "/UC-01.md", {
      schema: "product-engineering.backlog/v1",
      project_id: first,
      id: item,
      "pe-id": "UC-01",
      title: "Open the queue",
      type: "PBI",
    }),
  );
  const records = [
    [nfr, "Time each handover", []],
    [childNfr, "Load the next case quickly", [{ kind: "item", id: "UC-01" }]],
  ] as const;
  await Promise.all(
    records.map(([id, title, targets]) =>
      run(
        host.notes.seed(`${folder}/NFRs/${id}.md`, {
          schema: "product-engineering.nfr/v1",
          project_id: first,
          id,
          title,
          requirement: "Performance is measurable.",
          acceptance: "Show the next case in two seconds.",
          targets,
        }),
      ),
    ),
  );
  await run(rebuildNoteIndex);
}

async function assignEntity(root: HTMLElement, id: string) {
  const option = `${entityPanel} [name="domain-assignment"] option[value="${id}"]`;
  await shown(root, option);
  const picker = find<HTMLSelectElement>(root, `${entityPanel} select[name="domain-assignment"]`);
  picker.value = id;
  picker.dispatchEvent(new Event("change", { bubbles: true }));
  press(root, `${entityPanel} button[type="submit"]`);
}

it("shows inherited entity origins and assigns, removes and restores a map reference from both sides", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seed(host);
    const store = await run(NoteStore);
    await navigation.navigate(mapRoute);
    await shown(root, entityContext);
    press(root, entityContext);
    const inherited = '[aria-label="Entities from related records"]';
    await text(root, inherited, "ENT-01 · Shift");
    await text(root, inherited, "ENT-02 · Queue");
    const prdOrigin = `${inherited} button[data-pe-focus-key="story-entity-${prior}-${prd}"]`;
    press(root, prdOrigin);
    await eventually(() =>
      expect(navigation.current()).toEqual(knowledgeDetailRoute(first, prd, origin)),
    );
    await navigation.back();
    await shown(root, prdOrigin);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, prdOrigin)));
    const itemOrigin = `${inherited} button[data-pe-focus-key="story-entity-${viaItem}-UC-01"]`;
    press(root, itemOrigin);
    await eventually(() => expect(navigation.current()).toEqual(pbiDetailRoute(first, "UC-01")));
    await shown(root, testId("pbi-return"));
    press(root, testId("pbi-return"));
    await shown(root, entityPanel);
    await assignEntity(root, direct);
    await shown(root, explicitEntity);
    await text(root, entityContext, "1");
    const pbi = '[data-story-item="UC-01"]';
    press(root, pbi);
    const mapOrigin = `[data-pe-focus-key="pbi-entity-origin-${direct}-${map}"]`;
    await shown(root, mapOrigin);
    press(root, mapOrigin);
    await shown(root, entityContext);
    if (find(root, entityContext).getAttribute("aria-expanded") !== "true")
      press(root, entityContext);
    await shown(root, explicitEntity);
    press(root, explicitEntity);
    const reciprocal = `[data-domain-scope-link="${map}"]`;
    await shown(root, reciprocal);
    press(root, `${entityPanel} [data-domain-remove-assignment]`);
    await gone(root, reciprocal);
    expect((await run(store.readFresh(entityPath))).frontmatter.domain_scope).toEqual([]);
    await assignEntity(root, map);
    await shown(root, reciprocal);
    press(root, reciprocal);
    await shown(root, explicitEntity);
    expect((await run(store.readFresh(entityPath))).frontmatter.domain_scope).toEqual([
      { kind: "map", id: map },
    ]);
  });
}, 25_000);

it("assigns an NFR from the map and follows both its canonical reverse link and inherited item origin", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await seed(host);
    await navigation.navigate(mapRoute);
    await shown(root, nfrContext);
    press(root, nfrContext);
    const assign = testId("nfr-assign");
    await shown(root, assign);
    press(root, assign);
    const option = `${testId("nfr-assignment-picker")} input[value="${nfr}"]`;
    await shown(root, option);
    find<HTMLInputElement>(root, option).click();
    press(root, testId("nfr-assign-save"));
    await gone(root, testId("nfr-assignment-picker"));
    await text(root, nfrContext, "1");
    const nfrLink = `[data-nfr-open-record="${nfr}"]`;
    await shown(root, nfrLink);
    press(root, nfrLink);
    await eventually(() => expect(navigation.current()).toEqual(nfrCatalogRoute(first, nfr)));
    const reverse = `${panel} button[data-nfr-open-target="map:${map}"]`;
    await shown(root, reverse);
    press(root, reverse);
    await shown(root, nfrLink);
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(find(root, nfrLink)));
    const inherited = `[data-pe-focus-key="nfr-origin-${childNfr}-item:UC-01"]`;
    await shown(root, inherited);
    press(root, inherited);
    await eventually(() => expect(navigation.current()).toEqual(pbiDetailRoute(first, "UC-01")));
    await shown(root, testId("pbi-return"));
    const mapNfr = `[data-pe-focus-key="nfr-origin-${nfr}-map:${map}"]`;
    await shown(root, mapNfr);
    press(root, mapNfr);
    await eventually(() => expect(navigation.current()).toEqual(mapRoute));
  });
}, 20_000);
