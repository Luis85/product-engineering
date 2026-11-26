import { Layer } from "effect";
import { expect, it, vi } from "vitest";
import { AgentChat } from "../../../../src/application/integrations";
import type { ProviderChat } from "../../../../src/application/integrations";
import { rebuildNoteIndex } from "../../../../src/application/notes";
import { createProject } from "../../../../src/application/projects";
import { prototypesRoute, savePrototype } from "../../../../src/application/prototypes";
import { mountApp } from "../../../support/surface";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";
import { find, first } from "./knowledge-fixture";
import { map, mapFields } from "./story-map-ui-fixture";

const prototypeId = "prototype-33333333-3333-4333-8333-000000000660";
const title = "Try the exact export workflow";
const description = "Render the handover with Grüße ✓.";
const button = (id: string) => `[data-testid="prototype-${id}"]`;

async function withGeneration(
  test: (
    root: HTMLElement,
    stream: ReturnType<typeof vi.fn<ProviderChat["stream"]>>,
  ) => Promise<void>,
) {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "<main>Native candidate ✓</main>";
  });
  const host = testRuntime({
    language: "en",
    initialSettings: { aiEnabled: true, aiMode: "codex" },
    agentChat: Layer.succeed(AgentChat, { stream }),
  });
  const root = document.body.appendChild(document.createElement("div"));
  const run = host.runtime.runPromise.bind(host.runtime);
  let close: (() => void) | undefined;
  try {
    const { folder } = await run(
      createProject(first, {
        name: "Kundenportal",
        description: "Access",
        repository: "team/portal",
      }),
    );
    await host.vaultReady();
    await run(host.notes.seed(`${folder}/SM-01.md`, mapFields()));
    await run(rebuildNoteIndex);
    await run(
      savePrototype(first, prototypeId, {
        source: { kind: "map", projectId: first, id: map },
        title,
        description,
        designs: {},
      }),
    );
    const view = await mountApp(root, host.runtime, {
      initial: prototypesRoute(first, prototypeId),
    });
    close = view.close;
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe(title));
    await test(root, stream);
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}

it("discloses the exact scoped brief and destination before the explicit HTML generation call", () =>
  withGeneration(async (root, stream) => {
    const entry = await eventually(() => find<HTMLButtonElement>(root, button("generate-html")));
    expect(stream).not.toHaveBeenCalled();
    entry.click();
    const form = await eventually(() => find<HTMLFormElement>(root, button("generation-form")));
    await eventually(() => expect(form.textContent).toContain("Codex"));
    const payload = await eventually(() => find(root, button("generation-brief")));
    expect(payload.textContent).toContain(description);
    expect(payload.textContent).toContain("SM-01");
    expect(stream).not.toHaveBeenCalled();
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await eventually(() => expect(stream).toHaveBeenCalledTimes(1));
    expect(stream.mock.calls[0]?.[0]).toMatchObject({
      provider: "codex",
      purpose: "prototype-html",
    });
    expect(stream.mock.calls[0]?.[0].messages).toHaveLength(2);
    expect(stream.mock.calls[0]?.[0].messages[1]).toEqual({
      role: "user",
      content: payload.textContent,
    });
    await eventually(() => expect(root.textContent).toContain("Generated HTML"));
    await eventually(() => expect(entry).toBe(document.activeElement));
  }));
