import { expect } from "vitest";
import type { AppAdapters } from "../../../../src/application/app-services-layer";
import { createProject, projectOverviewRoute } from "../../../../src/application/projects";
import type { Route } from "../../../../src/application/routes";
import { appSurface } from "../../../../src/presentation/app-surface";
import { knowledgeScreens } from "../../../../src/presentation/knowledge/screens";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import type { MarkdownHost } from "../../../../src/presentation/shell/host";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

await Promise.all([preloadSurface(), knowledgeScreens.projectRecords.knowledge.load()]);

export const first = "project-33333333-3333-4333-8333-000000000001";
export const second = "project-33333333-3333-4333-8333-000000000002";
export const jobOne = "knowledge-33333333-3333-4333-8333-000000000005";
export const jobTwo = "knowledge-33333333-3333-4333-8333-000000000006";
export const vision = "knowledge-33333333-3333-4333-8333-000000000007";

export async function seedFoundations(host: ReturnType<typeof testRuntime>) {
  const records = [
    [jobOne, "jtbd", "JOB-12", "Approve a service request"],
    [jobTwo, "jtbd", "JOB-19", "Trace an approval"],
    [vision, "vision", "VIS-01", "A clear customer journey"],
  ] as const;
  await Promise.all(
    records.map(([id, kind, display_id, title]) =>
      host.runtime.runPromise(
        host.notes.seed(`Projects/Kundenportal/${display_id}.md`, {
          schema: "product-engineering.knowledge/v1",
          id,
          project_id: first,
          title,
          kind,
          display_id,
          approval: "approved",
        }),
      ),
    ),
  );
}

export function find<E extends HTMLElement>(root: HTMLElement, selector: string): E {
  const element = root.querySelector<E>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

export async function withProject(
  test: (context: {
    root: HTMLElement;
    host: ReturnType<typeof testRuntime>;
    navigation: ReturnType<typeof memoryNavigation<Route>>;
  }) => Promise<void>,
  markdownHost?: MarkdownHost,
  artifactGit?: AppAdapters["artifactGit"],
  agentChat?: AppAdapters["agentChat"],
) {
  const host = testRuntime({
    language: "en",
    ...(artifactGit ? { artifactGit } : {}),
    ...(agentChat ? { agentChat } : {}),
  });
  const root = document.body.appendChild(document.createElement("div"));
  const navigation = memoryNavigation(appSurface, projectOverviewRoute(first));
  let close: (() => void) | undefined;
  try {
    await host.runtime.runPromise(
      createProject(first, {
        name: "Kundenportal",
        description: "Serviceprozesse für B2B-Kunden",
        repository: "produktteam/kundenportal",
      }),
    );
    await host.vaultReady();
    close = await mountSurface(root, host.runtime, {
      surface: appSurface,
      navigation,
      ...(markdownHost ? { markdownHost } : {}),
    });
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe("Kundenportal"));
    await test({ root, host, navigation });
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}
