import { browser, expect } from "@wdio/globals";
import { afterEach, before, describe, it } from "mocha";
import type { ItemView, WorkspaceLeaf } from "obsidian";
import { AGENT_CHAT } from "../../../src/application/integrations";
import { catalogFor } from "../../../src/application/messages";
import {
  isProjectId,
  projectOverviewRoute,
  projectRecordRoute,
} from "../../../src/application/projects";
import { appRoutes } from "../../../src/application/routes";
import type { RouteLike } from "../../../src/application/shell";
import { writeNote } from "../items";
import {
  installConsoleSpy,
  openView,
  PLUGIN_ID,
  pluginProblems,
  readViewRoute,
  readVaultText,
  readDataText,
  removeDataFile,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
  VIEW_TYPE,
  writeDataFile,
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
const workspaceScreen = `${ROOT} [data-testid=project-workspace]`;
function menuButton(root: string, label: string) {
  return browser.$(
    `${root} [data-testid=frame-navigation] button[aria-label=${JSON.stringify(label)}]`,
  );
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

  it("hides the Obsidian view header only in the Product Engineering leaf", async () => {
    await openView();
    await expect(browser.$(workspaceScreen)).toBeDisplayed();
    const headers = await browser.executeObsidian(async ({ app }, type) => {
      const pluginLeaf = app.workspace.getLeavesOfType(type)[0];
      const note = app.vault.getFileByPath("Welcome.md");
      if (!pluginLeaf || !note) throw new Error("Expected a plugin leaf and a fixture note");
      const noteLeaf = app.workspace.getLeaf("split");
      try {
        await noteLeaf.openFile(note);
        const display = (leaf: typeof pluginLeaf) => {
          const header = leaf.view.containerEl.querySelector(":scope > .view-header");
          return header && header.ownerDocument.defaultView?.getComputedStyle(header).display;
        };
        return { plugin: display(pluginLeaf), note: display(noteLeaf) };
      } finally {
        noteLeaf.detach();
      }
    }, VIEW_TYPE);
    expect(headers.plugin).toBe("none");
    expect(headers.note).toBe("flex");
  });

  it("keeps accessible project controls without repetitive hover titles", async () => {
    await openView();
    const picker = browser.$(`${ROOT} [data-pe-focus-key=project-picker]`);
    await picker.waitForExist();
    await expect(picker).toHaveAttribute("aria-label", texts.projects.picker);
    await expect(picker).not.toHaveAttribute("title");
  });

  it("persists the chat route and resets the history on restart", async () => {
    await writeDataFile({
      schemaVersion: 1,
      codexPath: "C:/product-engineering-fixture/codex.exe",
    });
    await openView();
    await expect(browser.$(workspaceScreen)).toExist();
    await setViewRoute(chat);
    await expect(browser.$(chatScreen)).toExist();
    await expect(browser.$(`${chatScreen} textarea`)).not.toExist();
    await expect(browser.$(chatScreen)).toHaveText(expect.stringContaining("KI ist deaktiviert"));
    expect(await readViewRoute()).toEqual(chat);
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
    expect(await readViewRoute()).toEqual(chat);
    await expect(browser.$(`${ROOT} [data-testid=frame-history]`)).not.toExist();
    await expect(browser.$(`${chatScreen} textarea`)).not.toExist();
    await removeDataFile();

    for (const broken of [{ name: "unknown" }, { name: "settings", section: 42 }]) {
      await setViewRoute(broken);
      await expect(browser.$(workspaceScreen)).toExist();
      expect(await readViewRoute()).toEqual(appRoutes.start);
      await setViewRoute(chat);
      await expect(browser.$(chatScreen)).toExist();
    }
  });

  it("keeps history focus and returns to the start from a missing route", async () => {
    await openView();
    await openMissingRouteProbe();
    const root = `[data-e2e=navigation-probe] ${ROOT}`;
    const history = `${root} [data-testid=frame-history]`;
    const missing = `${root} [data-testid=not-found]`;
    const workspace = `${root} [data-testid=project-workspace]`;
    const back = `${history} [aria-label=${JSON.stringify(texts.shell.frame.back)}]`;
    const forward = `${history} [aria-label=${JSON.stringify(texts.shell.frame.forward)}]`;
    try {
      await width(960, root);
      await expect(browser.$(workspace)).toExist();
      await expect(browser.$(history)).not.toExist();
      await menuButton(root, "Probe").click();
      await expect(browser.$(missing)).toExist();
      await browser.$(missing).$(`button=${texts.shell.notFound.back}`).click();
      await expect(browser.$(workspace)).toExist();
      await browser.$(back).click();
      await expect(browser.$(missing)).toExist();
      await browser.$(back).click();
      await expect(browser.$(workspace)).toExist();
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

const project = texts.projects;
const content = `${ROOT} [data-testid=project-content]`;
const dialog = `${ROOT} [role=dialog]`;
const projectRoot = "Product Engineering/Projects";

function named(root: string, label: string) {
  return browser.$(`${root} button[aria-label=${JSON.stringify(label)}]`);
}

async function width(value: number, scope = ROOT) {
  return browser.execute(
    (selector, pixels) => {
      const root = document.querySelector<HTMLElement>(selector);
      if (!root) throw new Error("Project surface is missing");
      root.style.width = pixels + "px";
      root.style.maxWidth = pixels + "px";
      return { width: root.clientWidth, scroll: root.scrollWidth };
    },
    scope,
    value,
  );
}

async function createProjectFromForm(name: string, description: string, repository: string) {
  const form = browser.$(dialog);
  await form.$("input[name=name]").setValue(name);
  await form.$("input[name=description]").setValue(description);
  await form.$("input[name=repository]").setValue(repository);
  await form.$("button[type=submit]").click();
  await expect(browser.$(`${content} h1`)).toHaveText(name);
  const route = await readViewRoute();
  if (
    !route ||
    typeof route !== "object" ||
    !("projectId" in route) ||
    !isProjectId(route.projectId)
  ) {
    throw new Error("The project identity was not saved in the native leaf");
  }
  return route.projectId;
}

describe("project workspace", () => {
  it("creates projects through the native view and recovers their identity without preferences", async () => {
    await setViewRoute(appRoutes.start);
    await width(960);
    const protectedFolder = `${projectRoot}/Kundenportal`;
    const sentinel = `${protectedFolder}/Sentinel.md`;
    await writeNote(sentinel, "Keep this existing note.\n");

    await browser.$(workspaceScreen).$(`button=${project.create}`).click();
    await browser.$(dialog).$("button[type=submit]").click();
    await expect(browser.$(dialog)).toHaveText(expect.stringContaining(project.errors.name));
    await expect(browser.$(`${dialog} input[name=name]`)).toBeFocused();
    await browser.$(dialog).$(`button=${project.cancel}`).click();
    await expect(browser.$(dialog)).not.toBeDisplayed();
    expect(await readVaultText(`${protectedFolder}/Project.md`)).toBeNull();

    await browser.$(workspaceScreen).$(`button=${project.create}`).click();
    const first = await createProjectFromForm(
      "Kundenportal",
      "Serviceprozesse für B2B-Kunden",
      "produktteam/kundenportal",
    );
    const folder = `${protectedFolder} (2)`;
    const projectNote = await readVaultText(`${folder}/Project.md`);
    const backlog = await readVaultText(`${folder}/Backlog.base`);
    expect(projectNote).toContain(first);
    expect(backlog).toContain(first);
    expect(await readVaultText(sentinel)).toBe("Keep this existing note.\n");
    await menuButton(ROOT, project.administration).click();
    await expect(browser.$(content)).toHaveText(expect.stringContaining(`${folder}/Backlog.base`));
    await expect(browser.$(content).$("input[name=branch]")).toHaveValue("main");

    await named(ROOT, project.picker).click();
    await browser.$(dialog).$(`button=${project.create}`).click();
    const second = await createProjectFromForm(
      "Admin Console",
      "Rollen und Zugriffe verwalten",
      "produktteam/admin-console",
    );
    expect(second).not.toBe(first);
    expect(await readDataText()).toBeNull();
    const record = projectRecordRoute(
      { projectId: first, kind: "project", recordId: first },
      { section: "overview" },
    );
    await browser.executeObsidian(
      async ({ app }, type, route) => {
        const leaf = app.workspace.getLeaf("split");
        await leaf.setViewState({ type, active: true, state: { route } });
        leaf.view.containerEl.dataset.e2e = "project-secondary";
        await app.workspace.revealLeaf(leaf);
      },
      VIEW_TYPE,
      record,
    );
    await expect(browser.$(`[data-e2e=project-secondary] ${content} h1`)).toHaveText(
      "Kundenportal",
    );
    expect(await readViewRoute()).toEqual(projectOverviewRoute(second));

    await browser.waitUntil(
      async () => (await readVaultText(".obsidian/workspace.json"))?.includes(first) ?? false,
    );
    await browser.reloadObsidian();
    await installConsoleSpy();
    const leafRoutes = await browser.executeObsidian(
      ({ app }, type) =>
        app.workspace.getLeavesOfType(type).map((leaf) => leaf.getViewState().state?.route),
      VIEW_TYPE,
    );
    expect(leafRoutes).toContainEqual(record);
    expect(leafRoutes).toContainEqual(projectOverviewRoute(second));
    expect(await readVaultText(`${folder}/Project.md`)).toBe(projectNote);
    expect(await readVaultText(`${folder}/Backlog.base`)).toBe(backlog);
    await browser.executeObsidian(
      ({ app }, type, projectId) => {
        for (const leaf of app.workspace.getLeavesOfType(type)) {
          const route = leaf.getViewState().state?.route as
            { readonly projectId?: string } | undefined;
          if (route?.projectId !== projectId) leaf.detach();
        }
      },
      VIEW_TYPE,
      first,
    );
    expect(await pluginProblems()).toEqual([]);
  });

  it("opens project search from the host command and restores focus in a narrow leaf", async () => {
    await openView();
    await expect(browser.$(`${content} h1`)).toHaveText("Kundenportal");
    await width(960);
    const expandedWidth = await browser.$(content).getSize("width");
    await named(ROOT, project.collapse).click();
    await expect(named(ROOT, project.expand)).toBeFocused();
    await expect(named(ROOT, project.overview)).toBeDisplayed();
    expect(await browser.$(content).getSize("width")).toBeGreaterThan(expandedWidth + 90);

    const narrow = await width(390);
    expect(narrow.scroll).toBeLessThanOrEqual(narrow.width + 1);
    const drawer = named(ROOT, project.openNavigation);
    await drawer.click();
    await expect(named(dialog, project.picker)).toBeFocused();
    await browser.keys("Escape");
    await expect(drawer).toBeFocused();

    await browser.executeObsidianCommand(PLUGIN_ID + ":search-project");
    const searchbox = browser.$(`${dialog} input[type=search]`);
    await searchbox.waitForDisplayed();
    await searchbox.setValue(project.overview);
    await expect(browser.$(dialog)).toHaveText(expect.stringContaining(project.overview));
    await browser.keys("Escape");
    const search = named(ROOT, project.search.open);
    await expect(search).toBeFocused();
    await search.click();
    await expect(searchbox).toHaveValue(project.overview);
    await browser.keys("Enter");
    await expect(browser.$(dialog)).not.toBeDisplayed();
    expect(await readViewRoute()).toMatchObject({ name: "project-overview" });
    expect(await pluginProblems()).toEqual([]);
  });
});
