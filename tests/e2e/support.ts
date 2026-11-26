import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { browser } from "@wdio/globals";

export const PLUGIN_ID = "product-engineering";
export const VIEW_TYPE = PLUGIN_ID + "-view";
export const ROOT = "." + PLUGIN_ID + "-root";
export const DATA_FILE = ".obsidian/plugins/" + PLUGIN_ID + "/data.json";
export const TEST_LANGUAGE = "de";

const OPEN_VIEW_COMMAND = PLUGIN_ID + ":open-view";
const SETTINGS_MARKER = "data-e2e-product-engineering-settings";
export const SETTINGS_TAB = "[" + SETTINGS_MARKER + "]";

type ConsoleEntry = {
  readonly kind: "error" | "warn" | "uncaught" | "rejection";
  readonly message: string;
};
type ConsoleWindow = Window & { productEngineeringE2eConsole?: ConsoleEntry[] };

async function inMainWindow<T>(action: () => Promise<T>): Promise<T> {
  const main = await browser.getObsidianPage().getMainWindowHandle();
  const previous = await browser.getWindowHandle();
  if (main === previous) return action();
  await browser.switchToWindow(main);
  try {
    return await action();
  } finally {
    await browser.switchToWindow(previous);
  }
}

export async function installConsoleSpy(): Promise<void> {
  await inMainWindow(() =>
    browser.executeObsidian(() => {
      const owner = window as ConsoleWindow;
      const previous = owner.productEngineeringE2eConsole;
      if (previous) {
        previous.length = 0;
        return;
      }

      const entries: ConsoleEntry[] = [];
      owner.productEngineeringE2eConsole = entries;
      const output = globalThis.console;
      const describe = (value: unknown): string => {
        if (value instanceof Error) return value.message;
        if (typeof value === "string") return value;
        try {
          return JSON.stringify(value) ?? String(value);
        } catch {
          return "<unprintable>";
        }
      };

      for (const kind of ["error", "warn"] as const) {
        const original = output[kind].bind(output);
        output[kind] = (...args: unknown[]) => {
          entries.push({ kind, message: args.map(describe).join(" ") });
          original(...args);
        };
      }

      owner.addEventListener("error", (event) => {
        entries.push({ kind: "uncaught", message: event.message });
      });
      owner.addEventListener("unhandledrejection", (event) => {
        entries.push({ kind: "rejection", message: describe(event.reason) });
      });
    }),
  );
}

function isPluginProblem({ kind, message }: ConsoleEntry): boolean {
  const resizeObserver =
    /^(?:Uncaught )?(?:Error: )?ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)\.?$/i;
  if (resizeObserver.test(message.trim())) return false;
  const normalized = message.toLowerCase();
  return (
    kind === "uncaught" ||
    kind === "rejection" ||
    normalized.includes(PLUGIN_ID) ||
    normalized.includes("[vue") ||
    normalized.includes("nuxt")
  );
}

export async function pluginProblems(): Promise<string[]> {
  const entries = await inMainWindow(() =>
    browser.executeObsidian(() => (window as ConsoleWindow).productEngineeringE2eConsole),
  );
  if (!entries) throw new Error("Console spy is not installed in the main Obsidian window");
  return entries.filter(isPluginProblem).map(({ kind, message }) => kind + ": " + message);
}

function commandIsRegistered() {
  return browser.executeObsidian(({ app }, id) => {
    const host = app as typeof app & { commands: { commands: Record<string, unknown> } };
    return Object.hasOwn(host.commands.commands, id);
  }, OPEN_VIEW_COMMAND);
}

function waitForPluginCommand(registered: boolean) {
  return browser.waitUntil(async () => (await commandIsRegistered()) === registered, {
    timeoutMsg: "Product Engineering command registration did not change",
  });
}

export async function openView(): Promise<void> {
  await waitForPluginCommand(true);
  await browser.executeObsidianCommand(OPEN_VIEW_COMMAND);
}

export async function openViewSettings(): Promise<void> {
  await openView();
  await browser.$(`${ROOT} [data-testid=app-frame]`).waitForDisplayed();
  const route = await readViewRoute();
  if (route && typeof route === "object" && "name" in route && route.name === "settings") {
    if ("section" in route && route.section === "items") return;
    await browser.$(`${ROOT} [data-testid=settings-sections] button:first-child`).click();
    return;
  }
  const rail = browser.$(`${ROOT} [data-testid=project-rail]`);
  if (await rail.isDisplayed()) {
    await rail.$("[data-pe-focus-key=settings]").click();
  } else {
    await browser.$(`${ROOT} [data-testid=app-frame] header button[aria-expanded]`).click();
    await browser.$(`${ROOT} [role=dialog] [data-pe-focus-key=settings]`).click();
  }
}

export function readViewRoute(): Promise<unknown> {
  return browser.executeObsidian(
    ({ app }, type) => app.workspace.getLeavesOfType(type)[0]?.getViewState().state?.route,
    VIEW_TYPE,
  );
}

export async function setViewRoute(route: unknown): Promise<void> {
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

export async function enablePlugin(): Promise<void> {
  await browser.getObsidianPage().enablePlugin(PLUGIN_ID);
  await waitForPluginCommand(true);
}

export async function disablePlugin(): Promise<void> {
  await browser.getObsidianPage().disablePlugin(PLUGIN_ID);
  await waitForPluginCommand(false);
}

export async function reloadPlugin(): Promise<void> {
  await disablePlugin();
  await enablePlugin();
}

type NativeSettings = {
  open(): void;
  close(): void;
  openTabById(id: string): { readonly containerEl: HTMLElement } | null;
};

export async function openSettings(): Promise<void> {
  const main = await browser.getObsidianPage().getMainWindowHandle();
  await browser.switchToWindow(main);
  await browser.executeObsidian(
    ({ app }, id, marker) => {
      const { setting } = app as typeof app & { setting: NativeSettings };
      setting.open();
      const tab = setting.openTabById(id);
      if (!tab) throw new Error("Could not find the Product Engineering settings tab");
      tab.containerEl.setAttribute(marker, "");
    },
    PLUGIN_ID,
    SETTINGS_MARKER,
  );
  await browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);
        if (await browser.$(SETTINGS_TAB).isDisplayed()) return true;
      }
      return false;
    },
    { timeoutMsg: "Timed out opening the Product Engineering settings tab" },
  );
}

export async function closeSettings(): Promise<void> {
  const settingsWindow = await browser.getWindowHandle();
  const main = await browser.getObsidianPage().getMainWindowHandle();
  await browser.switchToWindow(main);
  await browser.executeObsidian(({ app }) => {
    (app as typeof app & { setting: NativeSettings }).setting.close();
  });
  if (settingsWindow === main) {
    await browser.$(SETTINGS_TAB).waitForDisplayed({ reverse: true });
  } else {
    await browser.waitUntil(
      async () => !(await browser.getWindowHandles()).includes(settingsWindow),
      {
        timeoutMsg: "Timed out closing the Obsidian settings window",
      },
    );
  }
}

export async function setTheme(theme: "light" | "dark"): Promise<void> {
  const mode = theme === "dark" ? "obsidian" : "moonstone";
  await browser.executeObsidian(({ app }, name) => {
    (app as typeof app & { changeTheme(value: string): void }).changeTheme(name);
  }, mode);
  await browser.waitUntil(
    () =>
      browser.executeObsidian(
        (_, name) => document.body.classList.contains(name),
        "theme-" + theme,
      ),
    { timeoutMsg: "Obsidian did not switch to the " + theme + " theme" },
  );
}

function vaultPath(name: string): string {
  const root = browser.getObsidianPage().getVaultPath();
  const filename = resolve(root, name);
  const within = relative(root, filename);
  if (!within || within === ".." || within.startsWith(".." + sep) || isAbsolute(within)) {
    throw new Error("Test file path is outside the isolated vault");
  }
  return filename;
}

export async function readVaultText(name: string): Promise<string | null> {
  try {
    return await readFile(vaultPath(name), "utf8");
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return null;
    throw cause;
  }
}

export async function writeVaultText(name: string, text: string): Promise<void> {
  const filename = vaultPath(name);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, text, "utf8");
}

export function readDataText(): Promise<string | null> {
  return readVaultText(DATA_FILE);
}

export function removeDataFile(): Promise<void> {
  return rm(vaultPath(DATA_FILE), { force: true });
}

export async function readDataFile(): Promise<unknown> {
  const text = await readDataText();
  return text === null ? null : JSON.parse(text);
}

export function writeDataFile(value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error("Plugin test data must be JSON");
  return writeVaultText(DATA_FILE, text + "\n");
}
