import { expect, it, vi } from "vitest";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import {
  importPrototypeHtml,
  preparePrototypeGeneration,
  prototypesSnapshot,
  runPrototypeGeneration,
  savePrototype,
} from "../../../src/application/prototypes";
import type {
  PrototypeGenerationDestination,
  PrototypeGenerationDisclosure,
  PrototypeGenerationProvider,
  PrototypeGenerationTarget,
} from "../../../src/application/prototypes";
import { testRuntime } from "../../support/runtime";

const projectId = "project-33333333-3333-4333-8333-000000000661";
const mapId = "story-map-33333333-3333-4333-8333-000000000662";
const prototypeId = "prototype-33333333-3333-4333-8333-000000000663";
const target: PrototypeGenerationTarget = { projectId, prototypeId };
const destination: PrototypeGenerationDestination = {
  kind: "provider",
  provider: "codex",
  label: "Explicit provider",
};
const imported = "<main>Original imported artifact</main>\r\n";

async function fixture(withArtifact = true) {
  const host = testRuntime();
  const run = host.runtime.runPromise.bind(host.runtime);
  const { folder } = await run(
    createProject(projectId, {
      name: "Export service cases",
      description: "Concise scope only",
      repository: "team/service",
    }),
  );
  await host.vaultReady();
  const mapPath = `${folder}/SM-01.md`;
  const map = {
    schema: "product-engineering.story-map/v1",
    id: mapId,
    project_id: projectId,
    display_id: "SM-01",
    title: "Service export",
    persona: "The shift coordinator",
    goal: "Handover open cases",
    activities: [],
    steps: [],
    slices: [],
    cards: [],
    references: ["[[Foundations/restricted.txt]]"],
  };
  await run(host.notes.seed(mapPath, map));
  host.projectFiles.seedReference(
    "Foundations/restricted.txt",
    new TextEncoder().encode("Local-only content"),
  );
  await run(rebuildNoteIndex);
  await run(
    savePrototype(projectId, prototypeId, {
      source: { projectId, kind: "map", id: mapId },
      title: "Try exporting",
      description: "Show the flow offline.",
      designs: {},
    }),
  );
  const record = async () => {
    await run(rebuildNoteIndex);
    const [current] = (await run(prototypesSnapshot(projectId))).records;
    if (!current) throw new Error("Expected prototype record");
    return current;
  };
  if (withArtifact) await run(importPrototypeHtml(await record(), imported, "original.html"));
  const store = await run(NoteStore);
  const saved = async () => (await run(store.readFresh((await record()).path))).frontmatter;
  return { ...host, run, record, saved, map, mapPath };
}

it("starts generation without replacement confirmation when only legacy metadata is present", async () => {
  const host = await fixture(false);
  try {
    const base = await host.record();
    await host.run(
      host.notes.seed(base.path, {
        ...base.frontmatter,
        uc: "UC-09",
        rev: 2,
        label: "CSV exportieren",
      }),
    );
    const prepared = await host.run(
      preparePrototypeGeneration(await host.record(), destination, "en"),
    );
    expect(prepared.replaceRequired).toBe(false);
    await host.run(
      runPrototypeGeneration(
        prepared,
        {
          signal: new AbortController().signal,
          active: () => target,
          replace: false,
        },
        async () => "<main>First saved artifact</main>",
      ),
    );
    expect((await host.saved()).output_html).toBe("<main>First saved artifact</main>");
  } finally {
    await host.runtime.dispose();
  }
});

it("discloses a typed destination and target without attached materials, then requires deliberate replacement", async () => {
  const host = await fixture();
  try {
    const base = await host.record();
    const prepared = await host.run(preparePrototypeGeneration(base, destination, "en"));
    const disclosure: PrototypeGenerationDisclosure = prepared.disclosure;
    expect(disclosure).toMatchObject({ target, destination });
    expect(disclosure.markdown).toContain("Show the flow offline.");
    expect(disclosure.markdown).not.toContain("restricted.txt");
    expect(disclosure.markdown).not.toContain("Local-only content");
    expect(prepared.replaceRequired).toBe(true);
    const fake = vi.fn<PrototypeGenerationProvider>(async () => "<main>Generated result ✓</main>");
    const active = () => target;
    const signal = new AbortController().signal;
    await expect(
      host.run(runPrototypeGeneration(prepared, { signal, active, replace: false }, fake)),
    ).rejects.toMatchObject({ reason: "generationReplacement" });
    expect(fake).not.toHaveBeenCalled();
    expect((await host.saved()).output_html).toBe(imported);
    await host.run(runPrototypeGeneration(prepared, { signal, active, replace: true }, fake));
    expect(fake).toHaveBeenCalledWith(prepared.disclosure, expect.any(AbortSignal));
    expect(await host.saved()).toMatchObject({
      output_html: "<main>Generated result ✓</main>",
      output_provenance: "generated",
      output_file_name: "PT-01.html",
    });
    const simulation = await host.run(
      preparePrototypeGeneration(
        await host.record(),
        { kind: "simulation", label: "Deterministic test simulator" },
        "de",
      ),
    );
    await host.run(
      runPrototypeGeneration(
        simulation,
        { signal, active, replace: true },
        async () => "<p>Simulation</p>",
      ),
    );
    expect((await host.saved()).output_provenance).toBe("simulation");
  } finally {
    await host.runtime.dispose();
  }
});

it("keeps the artifact for provider failure, invalid HTML, cancellation and a late scope or project switch", async () => {
  const host = await fixture();
  try {
    const base = await host.record();
    const prepared = await host.run(preparePrototypeGeneration(base, destination, "en"));
    const active = () => target;
    const signal = new AbortController().signal;
    const confirmation = { signal, active, replace: true } as const;
    await expect(
      host.run(
        runPrototypeGeneration(prepared, confirmation, async () => {
          throw new Error("Controlled provider refusal");
        }),
      ),
    ).rejects.toMatchObject({ reason: "generationFailed" });
    await expect(
      host.run(runPrototypeGeneration(prepared, confirmation, async () => "not HTML")),
    ).rejects.toMatchObject({ reason: "outputInvalid" });
    const cancel = new AbortController();
    await expect(
      host.run(
        runPrototypeGeneration(prepared, { ...confirmation, signal: cancel.signal }, async () => {
          cancel.abort();
          return "<main>Cancelled result</main>";
        }),
      ),
    ).rejects.toMatchObject({ reason: "generationCancelled" });
    let current: typeof target | undefined = target;
    await expect(
      host.run(
        runPrototypeGeneration(prepared, { ...confirmation, active: () => current }, async () => {
          current = undefined;
          return "<main>Wrong destination</main>";
        }),
      ),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    await expect(
      host.run(
        runPrototypeGeneration(prepared, confirmation, async () => {
          await host.run(
            host.notes.seed(host.mapPath, { ...host.map, goal: "Changed goal during generation" }),
          );
          return "<main>Late result</main>";
        }),
      ),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    expect((await host.saved()).output_html).toBe(imported);
  } finally {
    await host.runtime.dispose();
  }
});
