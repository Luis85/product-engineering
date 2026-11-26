import { createHash } from "node:crypto";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { createServer, get } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { prototypesRoute } from "../../../src/application/prototypes";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminFolder, adminProject, customerProject } from "../knowledge-vault";
import { capturePrototypeDownload } from "../prototype-native";
import {
  legacyPrototypeId,
  legacyPrototypePath,
  legacyPrototypeTitle,
  seedPrototypesVault,
} from "../prototype-vault";
import { openView, readVaultText, ROOT, setTheme, setViewRoute } from "../support";

const element = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const frame = () => element("prototype-preview");

before(async () => {
  await seedPrototypesVault();
  await openView();
});

async function createRegisterBrief(title: string) {
  await setViewRoute(prototypesRoute(customerProject));
  await element("prototype-create").click();
  const form = element("prototype-form");
  await form.$("select[name=scope]").selectByAttribute("value", "UC:UC-09");
  await form.$("input[name=title]").setValue(title);
  await form.$("textarea[name=description]").setValue("Einmal den bestätigten Export prüfen.");
  await element("prototype-save").click();
  await expect(element("prototype-detail").$("h1")).toHaveText(title);
}

async function loopback() {
  const probes: string[] = [];
  const server = createServer((request, response) => {
    probes.push(request.url ?? "");
    response.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
    response.end("V16 local request counter");
  });
  await new Promise<void>((ready, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ready);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local endpoint");
  return {
    url: `http://127.0.0.1:${address.port}`,
    probes,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}

it("isolates actual imported HTML from Obsidian, Node and all measured network requests", async () => {
  const listener = await loopback();
  try {
    const positive = await new Promise<number | undefined>((done, fail) =>
      get(listener.url + "/positive-control", (response) => {
        response.resume();
        response.once("end", () => done(response.statusCode));
      }).once("error", fail),
    );
    expect(positive).toBe(200);
    await createRegisterBrief("Offline-Vorschau sicher prüfen");
    const html = `<!doctype html><html><head>
      <base href="${listener.url}/base/">
      <link rel="stylesheet" href="${listener.url}/style.css">
      <link rel="prefetch" href="${listener.url}/prefetch">
      <style>@import "${listener.url}/import"; p { background-image: url(${listener.url}/css) }</style>
      </head><body>
      <img alt="externe Abbildung" src="${listener.url}/image" srcset="${listener.url}/srcset 1x">
      <iframe src="${listener.url}/iframe"></iframe>
      <button id="unsafe" onclick="fetch('${listener.url}/handler')">Ein externer Versuch</button>
      <a id="remote-link" href="${listener.url}/link">Externer Link</a>
      <form action="${listener.url}/form"><input type="submit"></form>
      <script>document.body.dataset.executed = "yes"; fetch("${listener.url}/script");</script>
      <button id="local" onclick="document.getElementById('out').textContent='Bestätigt ✓'">Bestätigen</button>
      <p id="out">Bereit</p>
      </body></html>`;
    await element("prototype-import-html").click();
    await element("prototype-html-source").setValue(html);
    await element("prototype-html-save").click();
    await expect(frame()).toHaveAttribute("sandbox", "allow-scripts");
    const parentRestricted = await browser.execute(
      (node: HTMLElement) => (node as HTMLIFrameElement).contentDocument === null,
      await frame(),
    );
    expect(parentRestricted).toBe(true);
    await browser.switchFrame(await frame());
    try {
      const boundary = await browser.execute(() => {
        const renderer = globalThis as typeof globalThis & {
          app?: unknown;
          process?: unknown;
          require?: unknown;
          obsidian?: unknown;
        };
        let parentAccess = true;
        try {
          void renderer.parent.document.body;
        } catch (error) {
          parentAccess = !(error instanceof DOMException && error.name === "SecurityError");
        }
        return {
          parentAccess,
          origin: renderer.origin,
          app: typeof renderer.app,
          require: typeof renderer.require,
          node: typeof renderer.process,
          obsidian: typeof renderer.obsidian,
          untrustedScript: Boolean(document.body.dataset.executed),
          nestedFrames: document.querySelectorAll("iframe").length,
          csp: document
            .querySelector('meta[http-equiv="Content-Security-Policy"]')
            ?.getAttribute("content"),
        };
      });
      expect(boundary).toMatchObject({
        parentAccess: false,
        origin: "null",
        app: "undefined",
        require: "undefined",
        node: "undefined",
        obsidian: "undefined",
        nestedFrames: 0,
      });
      expect(boundary.untrustedScript).toBe(false);
      expect(boundary.csp).toContain("connect-src 'none'");
      await browser.$("#unsafe").click();
      await expect(browser.$("#remote-link")).not.toHaveAttribute("href");
      await browser.$("#local").click();
      await expect(browser.$("#out")).toHaveText("Bestätigt ✓");
      const blocked = await browser.execute(async (url) => {
        try {
          await window.fetch(url);
          return false;
        } catch {
          return true;
        }
      }, listener.url + "/webdriver-csp-verification");
      expect(blocked).toBe(true);
    } finally {
      await browser.switchFrame(null);
    }
    expect(listener.probes).toEqual(["/positive-control"]);
    expect((await capturePrototypeDownload(await element("prototype-export-html"))).text).toBe(
      html,
    );
    process.stdout.write(
      "V16 preview network: one positive loopback control, no import/parse/render/interaction requests\n",
    );
  } finally {
    await listener.close();
  }
});

async function geometry(width: number, viewport: number) {
  const metrics = (viewWidth: number, height: number) =>
    browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
      width: viewWidth,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  const measure = async () =>
    browser.execute(
      (node: HTMLElement) => {
        const leaf = node.closest<HTMLElement>(".workspace-leaf");
        const view = node.querySelector("iframe");
        if (!leaf || !view) throw new Error("Missing installed preview");
        const box = leaf.getBoundingClientRect();
        const preview = node.getBoundingClientRect();
        return {
          width: Math.round(box.width),
          height: Math.round(box.height),
          contained: preview.left >= box.left && preview.right <= box.right,
          overflow: node.scrollWidth - node.clientWidth,
        };
      },
      await element("prototype-browser"),
    );
  await metrics(viewport, 940);
  const first = await measure();
  await metrics(viewport + width - first.width, 940 + 900 - first.height);
  await browser.waitUntil(async () => {
    const match = await measure();
    return match.width === width && match.height === 900;
  });
  const measured = await measure();
  expect(measured).toEqual({ width, height: 900, contained: true, overflow: 0 });
  process.stdout.write(`V16 installed preview geometry ${JSON.stringify(measured)}\n`);
  if (process.env.V16_CAPTURE_LAYOUT)
    await browser.saveScreenshot(resolve(`reports/product-views/V16-native-legacy-${width}.png`));
}

it("preserves authored PT-03 filtering, CSV and exact HTML in the normal leaf and narrow split", async () => {
  const bytes = await readVaultText(legacyPrototypePath);
  await setViewRoute(prototypesRoute(customerProject));
  await browser.$(`${ROOT} [data-prototype-row=PT-03]`).$(`button=${legacyPrototypeTitle}`).click();
  await expect(element("prototype-detail").$("h1")).toHaveText(legacyPrototypeTitle);
  await expect(element("prototype-detail")).toHaveText(
    expect.stringContaining("Gefilterte Servicefälle exportieren"),
  );
  await expect(element("prototype-browser")).toHaveText(expect.stringContaining("PT-03-rev2.html"));
  await setTheme("light");
  await geometry(1440, 1484);
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  await geometry(390, 1740);
  await browser.switchFrame(await frame());
  try {
    const statuses = browser.$("#status");
    const csv = browser.$("#export");
    await statuses.selectByVisibleText("Ohne Treffer");
    await expect(csv).toBeDisabled();
    await expect(browser.$("#empty")).toBeDisplayed();
    await statuses.selectByVisibleText("Offen");
    await expect(csv).toBeEnabled();
    const sample = await capturePrototypeDownload(await csv);
    expect(sample.name).toBe("servicefaelle-demo.csv");
    expect(sample.text).toContain("ID;Fall;Kontakt;Status\n");
    expect(sample.text).toContain("Offen");
    expect(sample.text).not.toContain("Abgeschlossen");
    expect(createHash("sha256").update(Buffer.from(sample.bytes)).digest("hex")).toBe(
      "6503c75c7e7bf7b4b42db7f2ecc89207880054644542df5d6a6a274b56e2d03d",
    );
    const firstCase = browser.$("button=Versandstatus aktualisieren");
    await expect(firstCase).toBeDisplayed();
    await expect(firstCase).toHaveAttribute("aria-expanded", "false");
    await browser.execute((control: HTMLElement) => control.focus(), await firstCase);
    await browser.keys("Enter");
    const caseDetail = browser.$("#case-detail-SF-1042");
    await expect(caseDetail).toBeDisplayed();
    await expect(caseDetail).toHaveText(
      expect.stringContaining("Kontakt: Nora Stein · Status: Offen"),
    );
    await expect(firstCase).toHaveAttribute("aria-expanded", "true");
    await expect(firstCase).toBeFocused();
    expect((await capturePrototypeDownload(await csv)).bytes).toEqual(sample.bytes);
    await browser.keys("Enter");
    await expect(caseDetail).not.toBeDisplayed();
    await expect(firstCase).toHaveAttribute("aria-expanded", "false");
    await browser.keys("Enter");
    const secondCase = browser.$("button=Kontakt zum Serviceteam");
    await secondCase.click();
    await expect(caseDetail).not.toBeDisplayed();
    await expect(browser.$("#case-detail-SF-1043")).toBeDisplayed();
    await statuses.selectByVisibleText("Abgeschlossen");
    await expect(browser.$("#case-detail-SF-1043")).not.toBeDisplayed();
  } finally {
    await browser.switchFrame(null);
  }
  const html = await capturePrototypeDownload(await element("prototype-export-html"));
  expect(html.name).toBe("PT-03-rev-2.html");
  expect(createHash("sha256").update(Buffer.from(html.bytes)).digest("hex")).toBe(
    "246339dae1d016c31eedb2f78734e07cede12af82747c4a278fe7435bcc9d419",
  );
  expect(await readVaultText(legacyPrototypePath)).toBe(bytes);
  await setViewRoute(prototypesRoute(customerProject, legacyPrototypeId));
  await expect(frame()).toBeDisplayed();
});

it("keeps the previous artifact while rejecting oversized local input in a short split dialog", async () => {
  await createRegisterBrief("Vorschau in der geteilten Ansicht");
  await element("prototype-import-html").click();
  await element("prototype-html-source").setValue("<main>Gespeicherter Stand</main>");
  await element("prototype-html-save").click();
  await expect(frame()).toBeDisplayed();
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  const folder = await mkdtemp(join(tmpdir(), "pe-v16-large-"));
  const oversized = join(folder, "zu-gross.html");
  try {
    await writeFile(oversized, "<p>" + "a".repeat(2 * 1024 * 1024) + "</p>", "utf8");
    const action = element("prototype-import-html");
    await browser.execute((control: HTMLElement) => control.focus(), await action);
    await browser.keys("Enter");
    await expect(element("prototype-html-source")).toBeFocused();
    await element("prototype-html-file").setValue(oversized);
    await expect(element("prototype-import-form").$("[role=alert]")).toHaveText(
      expect.stringContaining("bis zu 2 MiB"),
    );
    const size = await browser.execute(
      (form: HTMLElement) => {
        const dialog = form.closest<HTMLElement>("[role=dialog]");
        const leaf = form.closest<HTMLElement>(".workspace-leaf");
        const pane = leaf?.getBoundingClientRect();
        const rect = dialog?.getBoundingClientRect();
        return {
          width: pane?.width,
          contained: Boolean(pane && rect && rect.left >= pane.left && rect.right <= pane.right),
          overflow: dialog ? dialog.scrollWidth - dialog.clientWidth : -1,
        };
      },
      await element("prototype-import-form"),
    );
    expect(size).toEqual({ width: 390, contained: true, overflow: 0 });
    await browser.keys("Escape");
    await expect(action).toBeFocused();
    expect((await capturePrototypeDownload(await element("prototype-export-html"))).text).toBe(
      "<main>Gespeicherter Stand</main>",
    );
  } finally {
    await rm(oversized, { force: true });
    await rmdir(folder);
  }
});

it("keeps the original PT-03 HTML through native title and path changes within its owning project", async () => {
  const newTitle = "CSV-Export nach der Fallprüfung";
  await setViewRoute(prototypesRoute(customerProject, legacyPrototypeId));
  await expect(frame()).toBeDisplayed();
  await expect(element("prototype-detail").$(".pe-prototype-status")).toHaveText("Klickbar");
  const original = await capturePrototypeDownload(await element("prototype-export-html"));
  await browser.executeObsidian(
    async ({ app }, path, title, foreign, referenceTitle) => {
      const file = app.vault.getFileByPath(path);
      const peer = app.vault.getFileByPath(foreign);
      if (!file || !peer) throw new Error("Expected both native fixtures");
      await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
        fields.title = title;
      });
      await app.fileManager.renameFile(file, path.replace("PT-03.md", "PT-03 umbenannt.md"));
      await app.fileManager.processFrontMatter(peer, (fields: Record<string, unknown>) => {
        fields.title = referenceTitle;
      });
    },
    legacyPrototypePath,
    newTitle,
    `${adminFolder}/Admin-Prototyp.md`,
    legacyPrototypeTitle,
  );
  await expect(element("prototype-detail").$("h1")).toHaveText(newTitle);
  await expect(frame()).toBeDisplayed();
  await browser.reloadObsidian();
  await openView();
  await setViewRoute(prototypesRoute(customerProject, legacyPrototypeId));
  await expect(element("prototype-detail").$("h1")).toHaveText(newTitle);
  await expect(frame()).toBeDisplayed();
  await expect(element("prototype-detail").$(".pe-prototype-status")).toHaveText("Klickbar");
  const reopened = await capturePrototypeDownload(await element("prototype-export-html"));
  expect(reopened).toEqual(original);
  await setViewRoute(prototypesRoute(adminProject));
  const foreign = browser.$(`${ROOT} [data-prototype-row=PT-03]`);
  const foreignTitle = foreign.$(`button=${legacyPrototypeTitle}`);
  await expect(foreignTitle).toBeDisplayed();
  const registerStatus = await foreign.$(".pe-prototype-status").getText();
  await foreignTitle.click();
  await expect(element("prototype-detail").$("h1")).toHaveText(legacyPrototypeTitle);
  await expect(frame()).not.toExist();
  await expect(element("prototype-export-html")).not.toExist();
  const detailStatus = await element("prototype-detail").$(".pe-prototype-status").getText();
  expect([registerStatus, detailStatus]).toEqual(["Briefing", "Briefing"]);
});
