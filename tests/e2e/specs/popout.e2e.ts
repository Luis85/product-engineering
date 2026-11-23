import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import type { ItemView } from "obsidian";
import { PORTAL_CLASS } from "../../../src/presentation/shell/scope";
import { itemForm, openCreate, openItems } from "../items";
import { installConsoleSpy, openView, pluginProblems, ROOT, setTheme, VIEW_TYPE } from "../support";

type MountedView = ItemView & {
  readonly runtime: unknown;
  readonly loadSurface: () => Promise<{
    readonly mountSurface: (
      root: HTMLElement,
      runtime: unknown,
      options: { content: { render(): null } },
    ) => Promise<() => void>;
  }>;
};

type ProbeRoot = HTMLElement & { closeProbe?: () => void };

async function moveToPopout(): Promise<void> {
  await browser.executeObsidian(({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    if (!leaf) throw new Error("Expected the routed view");
    app.workspace.moveLeafToPopout(leaf);
  }, VIEW_TYPE);
  await browser.waitUntil(
    async () =>
      browser.executeObsidian(
        ({ app }, type, root) =>
          app.workspace
            .getLeavesOfType(type)
            .some(
              ({ view }) =>
                view.containerEl.ownerDocument !== document && view.containerEl.querySelector(root),
            ),
        VIEW_TYPE,
        ROOT,
      ),
    { timeoutMsg: "The routed surface did not move to the pop-out document" },
  );
}

async function mountDialogProbe() {
  return browser.executeObsidian(
    async ({ app }, type, rootSelector, portalClass) => {
      const view = app.workspace
        .getLeavesOfType(type)
        .find((leaf) => leaf.view.containerEl.ownerDocument !== document)?.view as
        MountedView | undefined;
      if (!view) throw new Error("Expected the pop-out view");
      const owner = view.containerEl.ownerDocument;
      const probe: ProbeRoot = owner.createElement("div");
      probe.dataset.e2e = "popout-probe";
      view.contentEl.append(probe);

      const madeByMain = new WeakSet<Element>();
      const original = Object.getOwnPropertyDescriptor(document, "createElement");
      const create = Reflect.get(document, "createElement");
      Object.defineProperty(document, "createElement", {
        configurable: true,
        value: (tag: string, options?: ElementCreationOptions) => {
          const element = create.call(document, tag, options);
          madeByMain.add(element);
          return element;
        },
      });

      try {
        const { mountSurface } = await view.loadSurface();
        const unmount = await mountSurface(probe, view.runtime, {
          content: { render: () => null },
        });
        const portal = probe.querySelector(`.${portalClass}`);
        if (!portal) {
          unmount();
          throw new Error("Expected a surface portal");
        }
        const dialog = owner.createElement("dialog");
        dialog.textContent = "Pop-out probe";
        dialog.setAttribute("aria-label", "Pop-out probe");
        portal.append(dialog);
        dialog.showModal();
        probe.closeProbe = () => {
          dialog.close();
          unmount();
          probe.remove();
        };
        return {
          surfaceOwnedByPopout: probe.matches(rootSelector) && probe.ownerDocument === owner,
          portalCreatedInPopout: portal.ownerDocument === owner && !madeByMain.has(portal),
          dialogInsidePortal: dialog.open && dialog.ownerDocument === owner,
          mainPortals: document.querySelectorAll(`.${portalClass}`).length,
          mainProbeDialogs: Array.from(document.querySelectorAll("dialog")).filter(
            (element) => element.textContent === "Pop-out probe",
          ).length,
        };
      } finally {
        if (original) Object.defineProperty(document, "createElement", original);
        else Reflect.deleteProperty(document, "createElement");
      }
    },
    VIEW_TYPE,
    ROOT,
    PORTAL_CLASS,
  );
}

async function closePopout(): Promise<void> {
  await browser.executeObsidian(({ app }, type) => {
    const leaves = app.workspace
      .getLeavesOfType(type)
      .filter(({ view }) => view.containerEl.ownerDocument !== document);
    for (const leaf of leaves) {
      const probe = leaf.view.containerEl.querySelector<ProbeRoot>("[data-e2e=popout-probe]");
      probe?.closeProbe?.();
      leaf.detach();
    }
  }, VIEW_TYPE);
}

it("keeps a moved view, its portal, and an open dialog in the pop-out document", async () => {
  await installConsoleSpy();
  await setTheme("light");
  await openView();
  await expect(browser.$(`${ROOT} [data-testid=project-workspace]`)).toExist();
  try {
    await moveToPopout();
    expect(await mountDialogProbe()).toEqual({
      surfaceOwnedByPopout: true,
      portalCreatedInPopout: true,
      dialogInsidePortal: true,
      mainPortals: 0,
      mainProbeDialogs: 0,
    });

    await setTheme("dark");
    await browser.waitUntil(
      async () =>
        browser.executeObsidian(
          ({ app }, type, root) => {
            const leaf = app.workspace.getLeavesOfType(type)[0];
            const element = leaf?.view.containerEl;
            return Boolean(
              element &&
              element.ownerDocument !== document &&
              element.ownerDocument.body.classList.contains("theme-dark") &&
              element.querySelector(`${root}.dark [data-testid=app-frame]`) &&
              element.querySelector("[data-e2e=popout-probe].dark dialog[open]"),
            );
          },
          VIEW_TYPE,
          ROOT,
        ),
      { timeoutMsg: "The pop-out surface did not update its theme" },
    );
  } finally {
    await closePopout();
  }

  await browser.waitUntil(
    async () =>
      browser.executeObsidian(
        ({ app }, type) => app.workspace.getLeavesOfType(type).length === 0,
        VIEW_TYPE,
      ),
    { timeoutMsg: "The pop-out routed view did not close" },
  );
  expect(await pluginProblems()).toEqual([]);
});

it("opens the real item sheet with focus inside the pop-out portal", async () => {
  await installConsoleSpy();
  await setTheme("light");
  await openItems();
  const main = await browser.getObsidianPage().getMainWindowHandle();
  const handles = new Set(await browser.getWindowHandles());
  try {
    await moveToPopout();
    const popup = await browser.waitUntil(
      async () =>
        (await browser.getWindowHandles()).find((handle) => !handles.has(handle)) ?? false,
    );
    await browser.switchToWindow(popup);
    await openCreate();
    const state = await browser.execute(
      (root, portalClass) => {
        const form = document.querySelector(root + " [data-testid='item-form']");
        return {
          portal: form?.closest("." + portalClass)?.ownerDocument === document,
          titleFocus: document.activeElement?.matches(
            root + " [data-testid='item-form'] [name='title']",
          ),
        };
      },
      ROOT,
      PORTAL_CLASS,
    );
    expect(state).toEqual({ portal: true, titleFocus: true });
    await browser.switchToWindow(main);
    await setTheme("dark");
    await browser.switchToWindow(popup);
    await browser.$(`${ROOT}.dark .${PORTAL_CLASS} [data-testid='item-form']`).waitForDisplayed();
    await browser.keys("Escape");
    await itemForm().waitForDisplayed({ reverse: true });
  } finally {
    await browser.switchToWindow(main);
    await closePopout();
  }
  expect(await pluginProblems()).toEqual([]);
});
