import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { AGENT_CHAT } from "../../../src/application/integrations";
import { catalogFor } from "../../../src/application/messages";
import {
  projectAdministrationRoute,
  projectOverviewRoute,
} from "../../../src/application/projects";
import {
  createProviderFixture,
  finishProviderCall,
  installProviderFixture,
  readProviderCalls,
} from "../ai-provider-fixture";
import { adminFolder, customerProject, projectFile, seedKnowledgeVault } from "../knowledge-vault";
import {
  closeSettings,
  openSettings,
  openView,
  readDataFile,
  readVaultText,
  reloadPlugin,
  ROOT,
  SETTINGS_TAB,
  setViewRoute,
  TEST_LANGUAGE,
  writeDataFile,
  writeVaultText,
} from "../support";

const text = catalogFor(TEST_LANGUAGE);
const settings = () => browser.$(SETTINGS_TAB);
const row = (name: string) => settings().$(`.setting-item-name=${name}`).$("../..");
const consent = () => row("KI-Copilot aktivieren").$(".checkbox-container");
const copilot = () =>
  browser.$(`${ROOT} button[aria-label=${JSON.stringify(text.projects.copilot)}]`);
const workspace = () => browser.$(`${ROOT} [data-testid=project-workspace]`);
const chat = () => browser.$(`${ROOT} [data-testid=agent-chat-screen]`);
const mode = () => row("Betriebsart").$('select:has(option[value="demo"])');
let provider: Awaited<ReturnType<typeof createProviderFixture>>;

async function expectNativeTabOpen() {
  await browser.waitUntil(async () => {
    for (const handle of await browser.getWindowHandles()) {
      await browser.switchToWindow(handle);
      if (await browser.$(".setting-item-name=KI-Copilot aktivieren").isDisplayed()) return true;
    }
    return false;
  });
}

async function configureCodex(executable: string) {
  await openSettings();
  await mode().selectByAttribute("value", "codex");
  await row(text.integrations.settings.ai.codexPath.name).$("input").setValue(executable);
  if (!(await consent().getAttribute("class"))?.includes("is-enabled")) await consent().click();
  await browser.waitUntil(async () => {
    const value = (await readDataFile()) as {
      aiMode?: string;
      aiEnabled?: boolean;
      codexPath?: string;
    };
    return value.aiMode === "codex" && value.aiEnabled === true && value.codexPath === executable;
  });
  await closeSettings();
}

async function sendPrompt(prompt: string) {
  await chat().$("textarea").setValue(prompt);
  await chat().$('button[type="submit"]').click();
}

async function openPendingCodex(prompt: string) {
  await installProviderFixture(provider.paths);
  await setViewRoute(projectOverviewRoute(customerProject));
  await configureCodex(provider.codexPath);
  await copilot().click();
  expect(await readProviderCalls()).toEqual([]);
  await sendPrompt(prompt);
  await browser.waitUntil(
    async () => (await readProviderCalls())[0]?.input.includes(prompt) === true,
  );
}

before(async () => {
  await seedKnowledgeVault();
  const project = await readVaultText(projectFile);
  if (!project) throw new Error("The legacy project fixture is missing");
  await writeVaultText(
    projectFile,
    project.replace(
      "---\n",
      "---\nmodel: legacy-project-model\nexecutable: legacy-project-executable\n",
    ),
  );
  provider = await createProviderFixture();
  await writeDataFile({
    schemaVersion: 1,
    codexPath: provider.codexPath,
    claudeCodePath: provider.claudeCodePath,
  });
  await reloadPlugin();
  await openView();
  await setViewRoute(projectOverviewRoute(customerProject));
  await expect(workspace().$("h1")).toHaveText("Kundenportal");
});

it("offers explicit native Copilot consent defaulted off with legacy preferences and running MCP", async () => {
  await expect(copilot()).not.toExist();

  await openSettings();
  const mcp = text.integrations.settings.mcp;
  try {
    await row(mcp.start).click();
    await expect(row(mcp.title).$(".setting-item-description")).toHaveText(/127\.0\.0\.1:\d+\/mcp/);
    expect(await readDataFile()).not.toHaveProperty("aiEnabled");
    await expect(consent()).toBeDisplayed();
    expect(await consent().getAttribute("class")).not.toContain("is-enabled");
  } finally {
    await row(mcp.stop).click();
    await closeSettings();
  }
  expect(await readProviderCalls()).toEqual([]);
});

it("persists one global keyboard opt-in through project navigation and vault reopen", async () => {
  const original = await readVaultText(projectFile);
  const other = await readVaultText(`${adminFolder}/Project.md`);
  await setViewRoute({ name: AGENT_CHAT });
  await expect(chat()).toBeDisplayed();
  await expect(chat().$("[role=alert]")).toHaveText(expect.stringContaining("KI ist deaktiviert"));
  await expect(chat().$("form")).not.toExist();

  await setViewRoute(projectAdministrationRoute(customerProject));
  await workspace().$("[role=tab][data-section=integrations]").click();
  await workspace().$(`button=${text.projects.integrations.settings}`).click();
  await expectNativeTabOpen();
  await openSettings();
  await browser.execute((control: HTMLElement) => control.focus(), await consent());
  await expect(consent()).toBeFocused();
  await browser.keys("Space");
  await browser.waitUntil(
    async () => ((await readDataFile()) as { aiEnabled?: boolean })?.aiEnabled === true,
  );
  await expect(consent()).toBeFocused();
  await closeSettings();

  await expect(copilot()).toBeDisplayed();
  await browser
    .$(
      `${ROOT} [data-testid=project-rail] button[aria-label=${JSON.stringify(text.projects.picker)}]`,
    )
    .click();
  await browser.$(`${ROOT} [role=dialog] button[aria-label="Admin Console"]`).click();
  await expect(workspace().$("h1")).toHaveText("Admin Console");
  await expect(copilot()).toBeDisplayed();
  await copilot().click();
  await expect(browser.$(`${ROOT} [role=dialog] textarea`)).toBeDisplayed();
  expect(await readProviderCalls()).toEqual([]);
  await sendPrompt("Eine ausdrücklich gestartete Demo");
  await expect(chat().$('[role="log"]')).toHaveText(
    expect.stringContaining(text.integrations.chat.demoReply),
  );
  await browser.keys("Escape");
  expect(await readProviderCalls()).toEqual([]);

  await browser.reloadObsidian();
  await installProviderFixture(provider.paths);
  await openView();
  await expect(workspace().$("h1")).toHaveText("Admin Console");
  await openSettings();
  expect(await consent().getAttribute("class")).toContain("is-enabled");
  await consent().click();
  await browser.waitUntil(
    async () => ((await readDataFile()) as { aiEnabled?: boolean })?.aiEnabled === false,
  );
  await closeSettings();
  await expect(copilot()).not.toExist();
  expect(await readProviderCalls()).toEqual([]);
  expect(await readVaultText(projectFile)).toBe(original);
  expect(await readVaultText(`${adminFolder}/Project.md`)).toBe(other);
});

it("names the active execution mode and destination and keeps invalid path input focused at 390px", async () => {
  await openSettings();
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const execution = mode();
  const destination = row("Datenübertragung");
  const path = row(text.integrations.settings.ai.codexPath.name).$("input");
  try {
    await expect(execution).toHaveValue("demo");
    await expect(destination).toHaveText(expect.stringContaining("Lokale Demo"));
    await browser.execute((control: HTMLElement) => control.focus(), await execution);
    await execution.selectByAttribute("value", "codex");
    await expect(execution).toBeFocused();
    await expect(destination).toHaveText(expect.stringContaining("Codex"));
    await expect(destination).toHaveText(expect.stringContaining("externe Anfragen"));
    await browser.waitUntil(
      async () => ((await readDataFile()) as { aiMode?: string })?.aiMode === "codex",
    );
    expect(await readDataFile()).not.toHaveProperty("aiEnabled", true);

    await path.click();
    await path.setValue("relative-codex.exe");
    await expect(row(text.integrations.settings.ai.codexPath.name)).toHaveText(
      expect.stringContaining(
        text.shell.issues["codexPath.invalid"]({ code: "codexPath.invalid" }),
      ),
    );
    await expect(path).toHaveValue("relative-codex.exe");
    await expect(path).toBeFocused();
    expect(await readDataFile()).toHaveProperty("codexPath", provider.codexPath);

    await path.setValue(provider.codexPath.replace("fixture-codex", "missing-fixture-codex"));
    await browser.waitUntil(
      async () =>
        ((await readDataFile()) as { codexPath?: string })?.codexPath?.endsWith(
          "missing-fixture-codex.exe",
        ) === true,
    );
    await expect(path).toBeFocused();
    const width = await browser.execute(
      (input: HTMLElement) => ({
        viewport: input.ownerDocument.defaultView?.innerWidth,
        right: input.getBoundingClientRect().right,
      }),
      await path,
    );
    expect(width.viewport).toBe(390);
    expect(width.right).toBeLessThanOrEqual(390);
  } finally {
    await browser.sendCommandAndGetResult("Emulation.clearDeviceMetricsOverride", {});
    await closeSettings();
  }
});

it("closes the local panel and aborts an explicit delayed request when the native mode changes", async () => {
  await openPendingCodex("Nur der laufende Codex-Auftrag");
  expect(await readProviderCalls()).toHaveLength(1);
  expect((await readProviderCalls())[0]?.provider).toBe("codex");

  await openSettings();
  await mode().selectByAttribute("value", "claude-code");
  await browser.waitUntil(
    async () => ((await readDataFile()) as { aiMode?: string })?.aiMode === "claude-code",
  );
  await closeSettings();
  await expect(chat()).not.toExist();
  await browser.waitUntil(async () => (await readProviderCalls())[0]?.aborted === true);
  await finishProviderCall(0, "Veraltete Antwort aus Codex");
  await expect(workspace().$("h1")).toBeFocused();
  await copilot().click();
  await sendPrompt("Jetzt nur Claude Code");
  await browser.waitUntil(
    async () => (await readProviderCalls())[1]?.input.includes("Jetzt nur Claude Code") === true,
  );
  const second = (await readProviderCalls())[1];
  expect(second?.provider).toBe("claude-code");
  expect(second?.input).not.toContain("Nur der laufende Codex-Auftrag");
  await finishProviderCall(1, "Antwort von Claude Code");
  await expect(chat().$('[role="log"]')).toHaveText(
    expect.stringContaining("Antwort von Claude Code"),
  );
  await expect(chat().$('[role="log"]')).not.toHaveText(
    expect.stringContaining("Veraltete Antwort aus Codex"),
  );
  await browser.keys("Escape");
});

async function retryUnavailableProvider(projectPanel: boolean) {
  await installProviderFixture(provider.paths);
  const bad = provider.codexPath.replace("fixture-codex", "missing-fixture-codex");
  await configureCodex(bad);
  await setViewRoute(projectPanel ? projectOverviewRoute(customerProject) : { name: AGENT_CHAT });
  if (projectPanel) await copilot().click();
  await expect(chat()).toBeDisplayed();
  const draft = "Diese Anfrage soll erneut versucht werden";
  await sendPrompt(draft);
  await expect(chat().$("[role=alert]")).toHaveText(
    expect.stringContaining("Codex ist nicht verfügbar"),
  );
  await expect(chat().$("textarea")).toHaveValue(draft);
  expect(await readProviderCalls()).toEqual([]);
  await chat().$("button=Programmdatei in den Einstellungen korrigieren").click();
  await expectNativeTabOpen();
  const correction = browser
    .$(`.setting-item-name=${text.integrations.settings.ai.codexPath.name}`)
    .$("../..")
    .$("input");
  await expect(correction).toBeFocused();
  await correction.setValue(provider.codexPath);
  await browser.waitUntil(
    async () =>
      ((await readDataFile()) as { codexPath?: string })?.codexPath === provider.codexPath,
  );
  await expect(correction).toBeFocused();
  await closeSettings();
  const field = browser.$(`${ROOT} [data-testid="agent-chat-screen"] textarea`);
  const remainedOpen = await field.isDisplayed();
  if (projectPanel && !remainedOpen) await copilot().click();
  await expect(field).toHaveValue(draft);
  expect(remainedOpen).toBe(true);
  expect(await readProviderCalls()).toEqual([]);
  await chat().$('button[type="submit"]').click();
  await browser.waitUntil(
    async () => (await readProviderCalls())[0]?.input.includes(draft) === true,
  );
  await finishProviderCall(0, "Korrigierte Programmdatei antwortet");
  await expect(chat().$('[role="log"]')).toHaveText(
    expect.stringContaining("Korrigierte Programmdatei antwortet"),
  );
  if (projectPanel) await browser.keys("Escape");
}

it("opens and focuses the unavailable provider setting for an explicit retry", async () => {
  await retryUnavailableProvider(false);
});

it("retains the project Copilot draft during same-mode executable correction and explicit retry", async () => {
  await retryUnavailableProvider(true);
});

it("cancels a delayed request on an active executable edit without closing the project panel", async () => {
  await openPendingCodex("Noch ausstehender Codex-Auftrag");
  const draft = "Ein neuer, noch nicht gesendeter Entwurf";
  await chat().$("textarea").setValue(draft);
  await openSettings();
  const replacement = provider.codexPath.replace("fixture-codex", "changed-fixture-codex");
  const path = row(text.integrations.settings.ai.codexPath.name).$("input");
  await path.setValue(replacement);
  await browser.waitUntil(
    async () => ((await readDataFile()) as { codexPath?: string })?.codexPath === replacement,
  );
  await closeSettings();
  await expect(chat().$("textarea")).toHaveValue(draft);
  await browser.waitUntil(async () => (await readProviderCalls())[0]?.aborted === true);
  await finishProviderCall(0, "Späte Antwort der alten Programmdatei");
  await expect(chat().$("[role=log]")).not.toHaveText(expect.stringContaining("Späte Antwort"));
  expect(await readProviderCalls()).toHaveLength(1);
  await browser.keys("Escape");
});

it("withdraws running consent and returns focus to project work before opening the Board", async () => {
  await openPendingCodex("Auftrag während des Widerrufs");
  await openSettings();
  await browser.execute((control: HTMLElement) => control.focus(), await consent());
  await browser.keys("Space");
  await browser.waitUntil(
    async () => ((await readDataFile()) as { aiEnabled?: boolean })?.aiEnabled === false,
  );
  await expect(consent()).toBeFocused();
  await closeSettings();
  await expect(chat()).not.toExist();
  await expect(copilot()).not.toExist();
  await expect(workspace().$("h1")).toBeFocused();
  await browser.waitUntil(async () => (await readProviderCalls())[0]?.aborted === true);
  await finishProviderCall(0, "Veraltete Antwort nach Widerruf");

  await browser.$(`${ROOT} [data-pe-focus-key="project-backlog"]`).click();
  await expect(browser.$(`${ROOT} [data-testid="backlog-board"]`)).toBeDisplayed();
  await setViewRoute({ name: AGENT_CHAT });
  await expect(chat()).toBeDisplayed();
  await expect(chat().$("[role=alert]")).toHaveText(expect.stringContaining("KI ist deaktiviert"));
  await expect(chat().$("form")).not.toExist();
  expect(await readProviderCalls()).toHaveLength(1);
});
