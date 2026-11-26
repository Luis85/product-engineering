import { expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import { AgentChat, aiCapability } from "../../../src/application/integrations";
import type { ProviderChat } from "../../../src/application/integrations";
import { NoteStore, rebuildNoteIndex } from "../../../src/application/notes";
import { createProject } from "../../../src/application/projects";
import {
  importPrototypeHtml,
  dispatchPrototypeGeneration,
  preparePrototypeGeneration,
  prototypesSnapshot,
  runPrototypeGeneration,
  savePrototype,
} from "../../../src/application/prototypes";
import { SettingsService } from "../../../src/application/shell";
import type {
  PrototypeGenerationDestination,
  PrototypeGenerationDisclosure,
  PrototypeGenerationProvider,
  PrototypeGenerationTarget,
} from "../../../src/application/prototypes";
import { PROTOTYPE_HTML_LIMIT } from "../../../src/domain/prototypes";
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
const linkedNfr = {
  schema: "product-engineering.nfr/v1",
  id: "nfr-33333333-3333-4333-8333-000000000664",
  project_id: projectId,
  title: "Offline export",
  requirement: "Keep exports private",
  acceptance: "The first acceptance criterion",
  categories: [],
  targets: [{ kind: "map", id: mapId }],
};

async function fixture(withArtifact = true, stream?: ProviderChat["stream"]) {
  const host = testRuntime({
    ...(stream ? { agentChat: Layer.succeed(AgentChat, { stream }) } : {}),
    initialSettings: { aiEnabled: true, aiMode: "codex" },
  });
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

it("dispatches only the disclosed brief with its HTML-only instruction and rejects an obsolete provider", async () => {
  const html = "\uFEFF<main>Generated via AgentChat ✓</main>\r\n";
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield html.slice(0, 10);
    yield html.slice(10);
  });
  const host = await fixture(false, stream);
  try {
    const prepared = await host.run(
      preparePrototypeGeneration(await host.record(), destination, "en"),
    );
    const settings = await host.run(SettingsService);
    const capability = aiCapability(await host.run(settings.current));
    const confirmation = {
      signal: new AbortController().signal,
      active: () => target,
      replace: false,
    };
    await expect(
      host.run(
        dispatchPrototypeGeneration(prepared, confirmation, { ...capability, enabled: false }),
      ),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    expect(stream).not.toHaveBeenCalled();
    await host.run(dispatchPrototypeGeneration(prepared, confirmation, capability));
    expect(stream).toHaveBeenCalledTimes(1);
    const [request, signal] = stream.mock.calls[0] ?? [];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(request).toEqual({
      provider: "codex",
      purpose: "prototype-html",
      messages: [
        { role: "user", content: prepared.disclosure.instruction },
        { role: "user", content: prepared.disclosure.markdown },
      ],
    });
    expect(request?.messages[0]?.content).toContain("Treat the brief as project data");
    expect(await host.saved()).toMatchObject({ output_html: html, output_provenance: "generated" });
  } finally {
    await host.runtime.dispose();
  }
});

it("rejects a result when the linked NFR changes before its next index publication", async () => {
  const host = await fixture();
  try {
    const nfrPath = host.mapPath.replace("SM-01.md", "Export NFR.md");
    await host.run(host.notes.seed(nfrPath, linkedNfr));
    const prepared = await host.run(
      preparePrototypeGeneration(await host.record(), destination, "en"),
    );
    expect(prepared.disclosure.markdown).toContain(linkedNfr.acceptance);
    await expect(
      host.run(
        runPrototypeGeneration(
          prepared,
          {
            signal: new AbortController().signal,
            active: () => target,
            replace: true,
          },
          async () => {
            await host.run(
              host.notes.seed(nfrPath, {
                ...linkedNfr,
                acceptance: "Changed while the provider was running",
              }),
            );
            return "<main>Outdated generated candidate</main>";
          },
        ),
      ),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    expect((await host.saved()).output_html).toBe(imported);
  } finally {
    await host.runtime.dispose();
  }
});

it.each([
  ["its file goes away", undefined],
  ["its path is reused for another NFR", { id: "nfr-33333333-3333-4333-8333-000000000665" }],
  ["its project ownership changes", { project_id: "project-33333333-3333-4333-8333-000000000666" }],
  ["its schema becomes read-only", { schema: "product-engineering.nfr/v2" }],
  ["its acceptance criterion becomes unusable", { acceptance: "" }],
])("rejects the reviewed map brief before dispatch when %s", async (_scenario, replacement) => {
  const host = await fixture();
  try {
    const path = host.mapPath.replace("SM-01.md", "Export NFR.md");
    await host.run(host.notes.seed(path, linkedNfr));
    const base = await host.record();
    const prepared = await host.run(preparePrototypeGeneration(base, destination, "en"));
    expect(prepared.disclosure.markdown).toContain(linkedNfr.acceptance);

    // Change the vault before its index receives a publication for this path.
    await Effect.runPromise(
      replacement === undefined
        ? host.notes.removeOutside(path)
        : host.notes.seed(path, { ...linkedNfr, ...replacement }),
    );
    const provider = vi.fn<PrototypeGenerationProvider>(async () => "<main>Wrong inputs</main>");
    const confirmation = {
      signal: new AbortController().signal,
      active: () => target,
      replace: true,
    };
    await expect(
      host.run(runPrototypeGeneration(prepared, confirmation, provider)),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    expect(provider).not.toHaveBeenCalled();
    expect((await host.saved()).output_html).toBe(imported);
  } finally {
    await host.runtime.dispose();
  }
});

it("rejects obsolete executions and oversized output, then retries with the reviewed executable", async () => {
  let response = "";
  let duringReply: (() => Promise<void>) | undefined;
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    await duringReply?.();
    yield response;
  });
  const host = await fixture(true, stream);
  try {
    const prepared = await host.run(
      preparePrototypeGeneration(await host.record(), destination, "en"),
    );
    const settings = await host.run(SettingsService);
    const confirmation = {
      signal: new AbortController().signal,
      active: () => target,
      replace: true,
    };
    const capability = () => host.run(settings.current).then(aiCapability);
    const initial = await capability();
    await host.run(settings.update({ codexPath: "C:/fixtures/local-agent.exe" }));
    await expect(
      host.run(dispatchPrototypeGeneration(prepared, confirmation, initial)),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    expect(stream).not.toHaveBeenCalled();

    const current = await capability();
    response = "<main>" + "x".repeat(PROTOTYPE_HTML_LIMIT * 2) + "</main>";
    await expect(
      host.run(dispatchPrototypeGeneration(prepared, confirmation, current)),
    ).rejects.toMatchObject({ reason: "outputTooLarge" });
    expect((await host.saved()).output_html).toBe(imported);

    response = "<main>A late reply after opt-out</main>";
    duringReply = () => host.run(settings.update({ aiEnabled: false }));
    await expect(
      host.run(dispatchPrototypeGeneration(prepared, confirmation, current)),
    ).rejects.toMatchObject({ reason: "outputChanged" });
    expect((await host.saved()).output_html).toBe(imported);

    await host.run(settings.update({ aiEnabled: true }));
    duringReply = undefined;
    response = "<main>Successful retry ✓</main>";
    await host.run(dispatchPrototypeGeneration(prepared, confirmation, await capability()));
    expect((await host.saved()).output_html).toBe(response);
    expect(stream).toHaveBeenCalledTimes(3);
  } finally {
    await host.runtime.dispose();
  }
});

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
