import { Layer } from "effect";
import { expect, vi } from "vitest";
import { AgentChat } from "../../../../src/application/integrations";
import type { ProviderChat } from "../../../../src/application/integrations";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { createProject } from "../../../../src/application/projects";
import { mountApp } from "../../../support/surface";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";
import { find, first, second } from "./knowledge-fixture";

export const primary = "knowledge-33333333-3333-4333-8333-000000000008";
const foreign = "knowledge-33333333-3333-4333-8333-000000000009";
export const unrelated = "knowledge-33333333-3333-4333-8333-000000000010";

export async function withReview(
  test: (fixture: {
    root: HTMLElement;
    panel: HTMLElement;
    stream: ReturnType<typeof vi.fn<ProviderChat["stream"]>>;
    host: ReturnType<typeof testRuntime>;
    mount: () => ReturnType<typeof mountApp>;
    reopen: () => Promise<HTMLElement>;
    view: Awaited<ReturnType<typeof mountApp>>;
    route: ReturnType<typeof knowledgeDetailRoute>;
  }) => Promise<void>,
) {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "Controlled answer";
  });
  const host = testRuntime({
    language: "en",
    initialSettings: { aiEnabled: true, aiMode: "codex" },
    agentChat: Layer.succeed(AgentChat, { stream }),
  });
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    const projects = [
      [first, "Kundenportal"],
      [second, "Foreign project"],
    ] as const;
    await Promise.all(
      projects.map(([id, name]) =>
        host.runtime.runPromise(
          createProject(id, {
            name,
            description: "Product description",
            repository: "team/product",
          }),
        ),
      ),
    );
    const records = [
      [primary, first, "PRD-03", "Exact handover"],
      [foreign, second, "PRD-03", "Foreign duplicate"],
      [unrelated, first, "PRD-04", "Unselected sibling"],
    ] as const;
    await Promise.all(
      records.map(([id, project_id, display_id, title]) =>
        host.runtime.runPromise(
          host.notes.seed(
            `Projects/${project_id}/${id}.md`,
            {
              schema: "product-engineering.knowledge/v1",
              id,
              project_id,
              title,
              kind: "prd",
              display_id,
              approval: "approved",
            },
            `Private body: ${title}`,
          ),
        ),
      ),
    );
    await host.vaultReady();
    const route = knowledgeDetailRoute(first, primary);
    const mount = async () => {
      close?.();
      const view = await mountApp(root, host.runtime, { initial: route });
      close = view.close;
      await eventually(() =>
        expect(root.querySelector("h1")?.textContent?.trim()).toBe("Exact handover"),
      );
      return view;
    };
    const reopen = async () => {
      (
        await eventually(() =>
          find<HTMLButtonElement>(root, '[data-testid="knowledge-note-actions"]'),
        )
      ).click();
      await eventually(() =>
        expect(root.querySelector('[data-testid="knowledge-ai-review"]')).not.toBeNull(),
      );
      find<HTMLButtonElement>(root, '[data-testid="knowledge-ai-review"]').click();
      const panel = await eventually(() => find(root, '[data-testid="copilot-workspace"]'));
      await eventually(() =>
        find(panel, `[data-testid="copilot-source"][value="knowledge:${primary}"]`),
      );
      return panel;
    };
    const view = await mount();
    const panel = await reopen();
    await test({ root, panel, stream, host, mount, reopen, view, route });
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}

export function fillPrompt(panel: HTMLElement, value: string) {
  const prompt = find<HTMLTextAreaElement>(panel, '[data-testid="copilot-prompt"]');
  prompt.value = value;
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
}

export function send(panel: HTMLElement) {
  find<HTMLFormElement>(panel, "form").dispatchEvent(new Event("submit", { cancelable: true }));
}

export function task(panel: HTMLElement, value: string) {
  const mode = find<HTMLSelectElement>(panel, '[data-testid="copilot-mode"]');
  mode.value = value;
  mode.dispatchEvent(new Event("change", { bubbles: true }));
  return mode;
}
