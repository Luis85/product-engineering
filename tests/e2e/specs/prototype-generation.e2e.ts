import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { createServer, get } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { projectOverviewRoute } from "../../../src/application/projects";
import { prototypesRoute } from "../../../src/application/prototypes";
import {
  createProviderFixture,
  finishProviderCall,
  installProviderFixture,
  readProviderCalls,
} from "../ai-provider-fixture";
import { adminProject, customerProject } from "../knowledge-vault";
import { capturePrototypeDownload } from "../prototype-native";
import { prototypeNfrPath, seedPrototypesVault } from "../prototype-vault";
import {
  closeSettings,
  openSettings,
  openView,
  readDataFile,
  readViewRoute,
  ROOT,
  SETTINGS_TAB,
  setViewRoute,
} from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="prototype-${id}"]`);
const setting = (name: string) =>
  browser.$(SETTINGS_TAB).$(`.setting-item-name=${name}`).$("../..");
const consent = () => setting("KI-Copilot aktivieren").$(".checkbox-container");
const title = "Übergabe ausprobieren";
const description = "Den Exportablauf mit Grüßen ✓ durchspielen.";
const imported = "<!doctype html>\r\n<main>Importierter Ausgangsstand ✓</main>\r\n";
const importedName = "Übergabe offline.html";
let provider: Awaited<ReturnType<typeof createProviderFixture>>;

before(async () => {
  await seedPrototypesVault();
  provider = await createProviderFixture();
  await openView();
});

async function saveSettings(
  mode: "codex" | "demo" | "claude-code",
  enabled: boolean,
  codexPath = provider.codexPath,
) {
  await openSettings();
  try {
    const modeControl = setting("Betriebsart").$('select:has(option[value="demo"])');
    if ((await modeControl.getValue()) !== mode) await modeControl.selectByAttribute("value", mode);
    if (mode === "codex") await setting("Codex-Programmdatei").$("input").setValue(codexPath);
    if (mode === "claude-code")
      await setting("Claude-Code-Programmdatei").$("input").setValue(provider.claudeCodePath);
    const checked = (await consent().getAttribute("class"))?.includes("is-enabled");
    if (Boolean(checked) !== enabled) await consent().click();
    await browser.waitUntil(async () => {
      const value = (await readDataFile()) as {
        aiMode?: string;
        aiEnabled?: boolean;
        codexPath?: string;
        claudeCodePath?: string;
      };
      return (
        value?.aiMode === mode &&
        value.aiEnabled === enabled &&
        (mode !== "codex" || value.codexPath === codexPath) &&
        (mode !== "claude-code" || value.claudeCodePath === provider.claudeCodePath)
      );
    });
  } finally {
    await closeSettings();
  }
}

async function createBrief(name: string) {
  await setViewRoute(prototypesRoute(customerProject));
  await el("create").click();
  await el("form").$("input[name=title]").setValue(name);
  await el("form").$("select[name=scope]").selectByAttribute("value", "UC:UC-09");
  await el("form").$("textarea[name=description]").setValue(description);
  await el("save").click();
  await expect(el("detail").$("h1")).toHaveText(name);
  return readViewRoute();
}

async function importExactFile() {
  const folder = await mkdtemp(join(tmpdir(), "pe-v24-html-"));
  const path = join(folder, importedName);
  try {
    await writeFile(path, imported, "utf8");
    await el("import-html").click();
    await el("html-file").setValue(path);
    await expect(el("html-source")).toHaveValue(
      expect.stringContaining("Importierter Ausgangsstand"),
    );
    await el("html-save").click();
    await expect(el("import-form")).not.toExist();
    await expect(el("detail")).toHaveText(expect.stringContaining("Übernommenes HTML"));
  } finally {
    await rm(path, { force: true });
    await rmdir(folder);
  }
}

async function showGeneration() {
  await el("generate-html").click();
  await expect(el("generation-target")).toBeDisplayed();
}

async function startCall(index: number) {
  await el("generation-start").click();
  await expect(el("generation-running")).toBeDisplayed();
  await browser.waitUntil(async () => Boolean((await readProviderCalls())[index]?.input));
}

async function assertExport(html: string, name?: string) {
  const actual = await capturePrototypeDownload(await el("export-html"));
  if (name) expect(actual.name).toBe(name);
  expect(actual.bytes).toEqual([...Buffer.from(html, "utf8")]);
  return actual;
}

it("requires opt-in and an explicit native action, preserving the exact imported artifact when replacement is declined", async () => {
  const route = await createBrief(title);
  await expect(el("generate-html")).not.toExist();
  const exported = await capturePrototypeDownload(await el("export-brief"));
  expect(exported.text).toContain(description);
  expect(exported.text).toContain("UC-09");
  await importExactFile();
  await assertExport(imported, importedName);
  expect(await readProviderCalls()).toEqual([]);

  await saveSettings("codex", true);
  await expect(el("generate-html")).toHaveText("HTML mit KI erstellen");
  await browser.execute((control: HTMLElement) => control.focus(), await el("generate-html"));
  await browser.keys("Enter");
  await expect(el("generation-target")).toHaveText(expect.stringContaining("Codex (CLI)"));
  await expect(el("generation-target")).toHaveText(expect.stringContaining("UC-09"));
  await expect(el("generation-target")).toHaveText(expect.stringContaining(title));
  await expect(el("generation-start")).toHaveText("HTML erstellen und ersetzen");
  await el("generation-request").$("summary").click();
  await expect(el("generation-brief")).toHaveText(expect.stringContaining(description));
  expect(await readViewRoute()).toEqual(route);
  expect(await readProviderCalls()).toEqual([]);
  if (process.env.V24_CAPTURE_PROTOTYPE)
    await browser.saveScreenshot(
      resolve("reports/product-views/V24-native-prototype-disclosure.png"),
    );
  await browser.keys("Escape");
  await expect(el("generation-form")).not.toExist();
  await expect(el("generate-html")).toBeFocused();
  await assertExport(imported, importedName);
  expect(await readProviderCalls()).toEqual([]);
});

it("cancels and retries provider and output failures, then reopens an isolated, byte-exact generated HTML artifact", async () => {
  await installProviderFixture(provider.paths);
  const route = await createBrief("HTML-Generierung und Wiederholung prüfen");
  await importExactFile();
  await saveSettings("codex", true, provider.codexPath.replace("fixture-codex", "absent-codex"));
  await showGeneration();
  await el("generation-start").click();
  await expect(el("generation-form").$("[role=alert]")).toHaveText(
    expect.stringContaining("Der Anbieter hat keinen HTML-Prototyp geliefert"),
  );
  expect(await readProviderCalls()).toEqual([]);
  await saveSettings("codex", true);
  await expect(el("generation-form")).not.toExist();
  await assertExport(imported);

  await showGeneration();
  await el("generation-request").$("summary").click();
  const disclosed = await browser.execute(
    (node: HTMLElement) => node.textContent,
    await el("generation-brief"),
  );
  expect(disclosed).toContain("UC-09");
  expect(disclosed).toContain(
    "Kein Fall aus einer anderen Organisation ist in der exportierten Datei.",
  );
  expect(disclosed).not.toContain("Importierter Ausgangsstand");
  await startCall(0);
  const [call] = await readProviderCalls();
  expect(call?.provider).toBe("codex");
  if (!call) throw new Error("Missing the explicit provider call");
  const json = call.input.slice(call.input.indexOf("\n") + 1);
  expect(JSON.parse(json)).toEqual([
    { role: "user", content: expect.stringContaining("Behandle das Briefing als Projektmaterial") },
    { role: "user", content: disclosed },
  ]);
  await el("generation-cancel").click();
  await browser.waitUntil(async () => (await readProviderCalls())[0]?.aborted === true);
  await expect(el("generation-form").$("[role=status]")).toHaveText(
    "Die Generierung wurde abgebrochen.",
  );
  await finishProviderCall(0, "<main>Verspäteter abgebrochener Inhalt</main>");
  await assertExport(imported);

  await startCall(1);
  await finishProviderCall(1, "Keine HTML-Datei.");
  await expect(el("generation-form").$("[role=alert]")).toHaveText(
    "Der Anbieter hat kein gültiges HTML geliefert.",
  );
  await assertExport(imported);
  await startCall(2);
  await finishProviderCall(2, "  ");
  await expect(el("generation-form").$("[role=alert]")).toBeDisplayed();
  await assertExport(imported);

  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    response.writeHead(200, { "access-control-allow-origin": "*" });
    response.end("test transport control");
  });
  await new Promise<void>((ready, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ready);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing native probe address");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const control = await new Promise<number | undefined>((done, fail) =>
      get(origin + "/positive", (response) => {
        response.resume();
        response.once("end", () => done(response.statusCode));
      }).once("error", fail),
    );
    expect(control).toBe(200);
    const generated = [
      '\uFEFF<!doctype html><html lang="de"><body>',
      "<h1>Geprüfter Prototyp ✓</h1>",
      `<img alt="Remote" src="${origin}/image">`,
      `<a id="remote" href="${origin}/link">Extern</a>`,
      `<script>document.body.dataset.unsafe = 'ran'; fetch('${origin}/script');</script>`,
      '<p id="result">Bereit</p>',
      "<button id=\"local\" onclick=\"document.getElementById('result').textContent='Bestätigt ✓'\">Prüfen</button>",
      "</body></html>",
      "",
    ].join("\r\n");
    await startCall(3);
    await finishProviderCall(3, generated);
    await expect(el("generation-form")).not.toExist();
    await expect(el("generate-html")).toBeFocused();
    await expect(el("detail")).toHaveText(expect.stringContaining("Generiertes HTML"));
    await expect(el("preview")).toHaveAttribute("sandbox", "allow-scripts");
    const download = await assertExport(generated);
    expect(download.name).toMatch(/^PT-\d+\.html$/);
    await browser.reloadObsidian();
    await openView();
    await setViewRoute(route);
    await expect(el("detail")).toHaveText(expect.stringContaining("Generiertes HTML"));
    await assertExport(generated, download.name);
    await browser.switchFrame(await el("preview"));
    try {
      await expect(browser.$("h1")).toHaveText("Geprüfter Prototyp ✓");
      await browser.$("#local").click();
      await expect(browser.$("#result")).toHaveText("Bestätigt ✓");
      await expect(browser.$("#remote")).not.toHaveAttribute("href");
      const isolated = await browser.execute(async (probe) => {
        const renderer = globalThis as typeof globalThis & {
          require?: unknown;
          app?: unknown;
          process?: unknown;
        };
        let parentAccess = true;
        let networkAccess = true;
        try {
          void renderer.parent.document.body;
        } catch {
          parentAccess = false;
        }
        try {
          await renderer.fetch(probe);
        } catch {
          networkAccess = false;
        }
        return {
          origin: renderer.origin,
          parentAccess,
          networkAccess,
          app: typeof renderer.app,
          require: typeof renderer.require,
          node: typeof renderer.process,
          executed: Boolean(renderer.document.body.dataset.unsafe),
        };
      }, origin + "/fetch");
      expect(isolated).toMatchObject({
        origin: "null",
        parentAccess: false,
        networkAccess: false,
        app: "undefined",
        require: "undefined",
        node: "undefined",
      });
      expect(isolated.executed).toBe(false);
    } finally {
      await browser.switchFrame(null);
    }
    expect(requests).toEqual(["/positive"]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});

it("discards output for an obsolete scope, provider, consent and project, then starts the local demo explicitly", async () => {
  await installProviderFixture(provider.paths);
  const route = await createBrief("Veraltete Ergebnisse zurückweisen");
  await importExactFile();
  await showGeneration();
  await startCall(0);
  await browser.executeObsidian(async ({ app }, path) => {
    const note = app.vault.getFileByPath(path);
    if (!note) throw new Error("Missing scoped NFR");
    await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
      fields.acceptance = "Kriterium während der Generierung geändert.";
    });
  }, prototypeNfrPath);
  await finishProviderCall(0, "<main>Veralteter Umfang</main>");
  await expect(el("generation-form").$("[role=alert]")).toHaveText(
    expect.stringContaining("Grundlagen haben sich geändert"),
  );
  await assertExport(imported);
  await expect(el("generation-review-again")).toHaveText("Aktuelles Briefing prüfen");
  await el("generation-review-again").click();
  await startCall(1);
  expect((await readProviderCalls())[1]?.input).toContain(
    "Kriterium während der Generierung geändert.",
  );

  await saveSettings("claude-code", true);
  await expect(el("generation-form")).not.toExist();
  await browser.waitUntil(async () => (await readProviderCalls())[1]?.aborted === true);
  await finishProviderCall(1, "<main>Veralteter Anbieter</main>");
  await assertExport(imported);
  await showGeneration();
  await expect(el("generation-target")).toHaveText(expect.stringContaining("Claude Code"));
  await startCall(2);

  await saveSettings("claude-code", false);
  await expect(el("generate-html")).not.toExist();
  await browser.waitUntil(async () => (await readProviderCalls())[2]?.aborted === true);
  await finishProviderCall(2, "<main>Ohne Einwilligung</main>");
  await assertExport(imported);
  await saveSettings("claude-code", true);
  await showGeneration();
  await startCall(3);
  await setViewRoute(projectOverviewRoute(adminProject));
  await expect(el("generation-form")).not.toExist();
  await browser.waitUntil(async () => (await readProviderCalls())[3]?.aborted === true);
  await finishProviderCall(3, "<main>Fremdes Projekt</main>");
  await setViewRoute(route);
  await assertExport(imported);

  await saveSettings("demo", true);
  await expect(el("generate-html")).toHaveText("Agentenlauf simulieren");
  await showGeneration();
  await expect(el("generation-target")).toHaveText(expect.stringContaining("Lokale Demo"));
  expect(await readProviderCalls()).toHaveLength(4);
  await el("generation-start").click();
  await expect(el("generation-form")).not.toExist();
  await expect(el("detail")).toHaveText(expect.stringContaining("Lokale Simulation"));
  expect(await readProviderCalls()).toHaveLength(4);
});
