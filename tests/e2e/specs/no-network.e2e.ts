import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import type { ItemView, WorkspaceLeaf } from "obsidian";
import { AGENT_CHAT } from "../../../src/application/integrations";
import { PORTAL_CLASS } from "../../../src/presentation/shell/scope";
import { installConsoleSpy, openView, pluginProblems, ROOT, VIEW_TYPE } from "../support";

type NetworkProbe = {
  readonly attempted: string[];
  offlineResponses: number;
  readonly restore: () => void;
};

type ProbeWindow = Window & { productEngineeringIconProbe?: NetworkProbe };

type ProbeDefinition = {
  readonly menu: readonly {
    readonly route: { readonly name: string };
    readonly label: () => string;
    readonly icon: string;
  }[];
};

type ProbeSource = ItemView & {
  readonly runtime: unknown;
  readonly surfaces: Set<() => void>;
  readonly definition: ProbeDefinition;
};

const missingIcon = "i-lucide-product-engineering-missing-probe";

async function spyOnLookups(): Promise<void> {
  await browser.executeObsidian((_, icon) => {
    const owner = window as ProbeWindow;
    const originalFetch = globalThis.fetch;
    const OriginalResponse = globalThis.Response;
    const probe: NetworkProbe = {
      attempted: [],
      offlineResponses: 0,
      restore: () => {
        globalThis.fetch = originalFetch;
        globalThis.Response = OriginalResponse;
        delete owner.productEngineeringIconProbe;
      },
    };
    globalThis.fetch = (input, options) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes(icon.replace(/^i-lucide-/, "")) && /^https?:/i.test(url)) {
        probe.attempted.push(url);
        return Promise.resolve(new OriginalResponse(null, { status: 404 }));
      }
      return originalFetch(input, options);
    };
    // The offline adapter resolves its lookup with a local synthetic 404.
    globalThis.Response = class extends OriginalResponse {
      constructor(...args: ConstructorParameters<typeof Response>) {
        super(...args);
        if (this.status === 404 && this.url === "") probe.offlineResponses += 1;
      }
    };
    owner.productEngineeringIconProbe = probe;
  }, missingIcon);
}

async function openIconProbe(): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, type, routeName, icon, portalClass) => {
      const original = app.workspace.getLeavesOfType(type)[0]?.view as ProbeSource | undefined;
      const probe = (window as ProbeWindow).productEngineeringIconProbe;
      if (!original || !probe) throw new Error("Expected a routed view and the icon lookup spy");
      const definition = {
        ...original.definition,
        menu: [{ route: { name: routeName }, label: () => "Icon probe", icon }],
      };
      const View = original.constructor as new (
        leaf: WorkspaceLeaf,
        runtime: unknown,
        surfaces: Set<() => void>,
        definition: ProbeDefinition,
      ) => ItemView;
      const leaf = app.workspace.getLeaf("tab");
      const view = new View(leaf, original.runtime, original.surfaces, definition);
      view.containerEl.dataset.e2e = "icon-probe";
      probe.offlineResponses = 0;
      probe.attempted.length = 0;
      performance.clearResourceTimings();
      await leaf.open(view);
      await app.workspace.revealLeaf(leaf);

      const portal = view.contentEl.querySelector(`.${portalClass}`);
      if (!portal) throw new Error("Expected the probe portal");
      const dialog = portal.ownerDocument.createElement("dialog");
      dialog.setAttribute("aria-label", "Icon probe");
      dialog.textContent = "Icon probe";
      portal.append(dialog);
      dialog.showModal();
    },
    VIEW_TYPE,
    AGENT_CHAT,
    missingIcon,
    PORTAL_CLASS,
  );
}

async function closeIconProbe(): Promise<void> {
  await browser.executeObsidian(({ app }) => {
    const leaves: WorkspaceLeaf[] = [];
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.containerEl.dataset.e2e === "icon-probe") leaves.push(leaf);
    });
    for (const leaf of leaves) {
      leaf.view.containerEl.querySelector("dialog")?.close();
      leaf.detach();
    }
    (window as ProbeWindow).productEngineeringIconProbe?.restore();
  });
}

it("renders a view and dialog without sending a missing-icon request", async () => {
  await installConsoleSpy();
  await spyOnLookups();
  try {
    await openView();
    await expect(browser.$(`${ROOT} [data-testid=project-workspace]`)).toExist();
    await openIconProbe();
    await expect(browser.$(`[data-e2e=icon-probe] ${ROOT} dialog[open]`)).toExist();
    await browser.waitUntil(
      async () =>
        browser.executeObsidian(() => {
          const probe = (window as ProbeWindow).productEngineeringIconProbe;
          return Boolean(probe && (probe.offlineResponses > 0 || probe.attempted.length > 0));
        }),
      { timeoutMsg: "The missing icon did not reach the lookup adapter" },
    );
    const external = await browser.executeObsidian(() => {
      const attempted = (window as ProbeWindow).productEngineeringIconProbe?.attempted ?? [];
      const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
      return [...attempted, ...resources].filter((url) => /^(?:https?|wss?):/i.test(url));
    });
    expect(external).toEqual([]);
  } finally {
    await closeIconProbe();
  }
  expect(await pluginProblems()).toEqual([]);
});
