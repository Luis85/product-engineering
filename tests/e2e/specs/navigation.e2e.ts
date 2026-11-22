import { browser, expect } from "@wdio/globals";
import { afterEach, before, describe, it } from "mocha";
import type { ItemView, WorkspaceLeaf } from "obsidian";
import { AGENT_CHAT } from "../../../src/application/integrations";
import { catalogFor } from "../../../src/application/messages";
import { appRoutes } from "../../../src/application/routes";
import type { RouteLike } from "../../../src/application/shell";
import {
  installConsoleSpy,
  openView,
  pluginProblems,
  readVaultText,
  ROOT,
  TEST_LANGUAGE,
  VIEW_TYPE,
} from "../support";

type ProbeDefinition = {
  readonly decode: (value: unknown) => RouteLike;
  readonly equals: (left: RouteLike, right: RouteLike) => boolean;
  readonly screen: (route: RouteLike) => unknown;
  readonly menu: readonly {
    readonly route: RouteLike;
    readonly label: () => string;
    readonly icon: string;
  }[];
};

type ProbeHost = ItemView & {
  readonly runtime: unknown;
  readonly surfaces: Set<() => void>;
  readonly definition: ProbeDefinition;
};

const texts = catalogFor(TEST_LANGUAGE);
const chat = { name: AGENT_CHAT };
const chatScreen = `${ROOT} [data-testid=agent-chat-screen]`;
const settingsScreen = `${ROOT} [data-testid=items-screen]`;
function menuButton(root: string, label: string) {
  return browser.$(`${root} [data-testid=frame-navigation]`).$(`button=${label}`);
}

function isChatRoute(value: unknown): boolean {
  return Boolean(
    value && typeof value === "object" && "name" in value && value.name === AGENT_CHAT,
  );
}

function layoutIncludesChat(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if ("type" in value && value.type === VIEW_TYPE && "state" in value) {
    const state = value.state;
    return Boolean(
      state && typeof state === "object" && "route" in state && isChatRoute(state.route),
    );
  }
  return Object.values(value as Record<string, unknown>).some(layoutIncludesChat);
}

async function readRoute(): Promise<unknown> {
  return browser.executeObsidian(({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    return leaf?.getViewState().state?.route;
  }, VIEW_TYPE);
}

async function setRoute(route: unknown): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, type, value) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      if (!leaf) throw new Error("Expected the routed view");
      await leaf.setViewState({ type, active: true, state: { route: value } });
    },
    VIEW_TYPE,
    route,
  );
}

async function openMissingRouteProbe(): Promise<void> {
  await browser.executeObsidian(async ({ app }, type) => {
    const live = app.workspace.getLeavesOfType(type)[0]?.view as ProbeHost | undefined;
    if (!live) throw new Error("Expected the routed view");
    const initial = live.definition;
    const probe = { name: "probe" };
    const probeRoute = (route: unknown): boolean =>
      Boolean(route && typeof route === "object" && "name" in route && route.name === "probe");
    const definition: ProbeDefinition = {
      ...initial,
      decode: (value) => (probeRoute(value) ? probe : initial.decode(value)),
      equals: (left, right) => {
        if (probeRoute(left) || probeRoute(right)) return left.name === right.name;
        return initial.equals(left, right);
      },
      screen: (route) => (probeRoute(route) ? undefined : initial.screen(route)),
      menu: [...initial.menu, { route: probe, label: () => "Probe", icon: "i-lucide-settings" }],
    };

    const View = live.constructor as new (
      leaf: WorkspaceLeaf,
      runtime: unknown,
      surfaces: Set<() => void>,
      definition: ProbeDefinition,
    ) => ItemView;
    const leaf = app.workspace.getLeaf("tab");
    const view = new View(leaf, live.runtime, live.surfaces, definition);
    view.containerEl.dataset.e2e = "navigation-probe";
    await leaf.open(view);
    await app.workspace.revealLeaf(leaf);
  }, VIEW_TYPE);
}

async function closeMissingRouteProbe(): Promise<void> {
  await browser.executeObsidian(({ app }) => {
    const leaves: WorkspaceLeaf[] = [];
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.containerEl.dataset.e2e === "navigation-probe") leaves.push(leaf);
    });
    for (const leaf of leaves) leaf.detach();
  });
}

describe("routed view", () => {
  before(installConsoleSpy);
  afterEach(async () => {
    expect(await pluginProblems()).toEqual([]);
  });

  it("persists the chat route and resets the history on restart", async () => {
    await openView();
    await expect(browser.$(settingsScreen)).toExist();
    await menuButton(ROOT, texts.integrations.chat.title).click();
    await expect(browser.$(chatScreen)).toExist();
    expect(await readRoute()).toEqual(chat);
    await expect(browser.$(`${ROOT} [data-testid=frame-history]`)).toExist();
    await browser.waitUntil(
      async () => {
        const text = await readVaultText(".obsidian/workspace.json");
        if (!text) return false;
        try {
          return layoutIncludesChat(JSON.parse(text) as unknown);
        } catch {
          return false;
        }
      },
      { timeoutMsg: "The workspace did not save the chat route" },
    );
    expect(await pluginProblems()).toEqual([]);

    await browser.reloadObsidian();
    await installConsoleSpy();
    await expect(browser.$(chatScreen)).toExist();
    expect(await readRoute()).toEqual(chat);
    await expect(browser.$(`${ROOT} [data-testid=frame-history]`)).not.toExist();

    for (const broken of [{ name: "unknown" }, { name: "settings", section: 42 }]) {
      await setRoute(broken);
      await expect(browser.$(settingsScreen)).toExist();
      expect(await readRoute()).toEqual(appRoutes.start);
      await menuButton(ROOT, texts.integrations.chat.title).click();
      await expect(browser.$(chatScreen)).toExist();
    }
  });

  it("keeps history focus and returns to the start from a missing route", async () => {
    await openView();
    await openMissingRouteProbe();
    const root = `[data-e2e=navigation-probe] ${ROOT}`;
    const history = `${root} [data-testid=frame-history]`;
    const missing = `${root} [data-testid=not-found]`;
    const items = `${root} [data-testid=items-screen]`;
    const back = `${history} [aria-label=${JSON.stringify(texts.shell.frame.back)}]`;
    const forward = `${history} [aria-label=${JSON.stringify(texts.shell.frame.forward)}]`;
    try {
      await expect(browser.$(items)).toExist();
      await expect(browser.$(history)).not.toExist();
      await menuButton(root, "Probe").click();
      await expect(browser.$(missing)).toExist();
      await browser.$(missing).$(`button=${texts.shell.notFound.back}`).click();
      await expect(browser.$(items)).toExist();
      await browser.$(back).click();
      await expect(browser.$(missing)).toExist();
      await browser.$(back).click();
      await expect(browser.$(items)).toExist();
      await expect(browser.$(back)).toHaveAttribute("aria-disabled", "true");
      await expect(browser.$(back)).toBeEnabled();
      await browser.$(back).click();
      expect(
        await browser.executeObsidian(
          (_, selector) => document.activeElement?.matches(selector) ?? false,
          back,
        ),
      ).toBe(true);
      await browser.$(forward).click();
      await expect(browser.$(missing)).toExist();
    } finally {
      await closeMissingRouteProbe();
    }
  });

  it("opens a file-explorer-style click in a different leaf", async () => {
    await openView();
    await expect(browser.$(`${ROOT} [data-testid=app-frame]`)).toExist();
    const opened = await browser.executeObsidian(async ({ app }, type) => {
      const shell = app.workspace.getLeavesOfType(type)[0];
      const note = app.vault.getMarkdownFiles()[0];
      if (!shell || !note) throw new Error("Expected the routed view and a fixture note");
      await app.workspace.revealLeaf(shell);
      app.workspace.setActiveLeaf(shell, { focus: true });
      const target = app.workspace.getLeaf(false);
      await target.openFile(note, { active: true });
      return {
        usedShellLeaf: target === shell,
        shellViewType: shell.view.getViewType(),
        matchesNote: target.view.getState().file === note.path,
      };
    }, VIEW_TYPE);
    expect(opened).toEqual({ usedShellLeaf: false, shellViewType: VIEW_TYPE, matchesNote: true });
  });
});
