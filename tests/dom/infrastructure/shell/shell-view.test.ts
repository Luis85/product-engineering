import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { bootstrap } from "../../../../src/bootstrap";
import { SHELL_VIEW_TYPE, ShellView } from "../../../../src/infrastructure/obsidian/shell";
import type { SurfaceDefinition, SurfaceLoader } from "../../../../src/presentation/shell/host";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

vi.mock("obsidian", () => import("@test/obsidian"));

await preloadSurface();

class TestPlugin extends Plugin {}

const start = { name: "probe" } as const;
const definition: SurfaceDefinition<typeof start> = {
  start,
  decode: () => start,
  equals: () => true,
  menu: [],
  screen: () => undefined,
};

type MountedSurface = Awaited<ReturnType<SurfaceLoader>>;
type Mount = () => Promise<() => void>;

function deferred<A>() {
  let resolve!: (value: A) => void;
  const ready = new Promise<A>((finish) => {
    resolve = finish;
  });
  return { ready, resolve };
}

function testView(load: SurfaceLoader) {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  const { runtime } = testRuntime();
  const surfaces = new Set<() => void>();
  plugin.registerView(
    SHELL_VIEW_TYPE,
    (leaf) => new ShellView(leaf, runtime, surfaces, definition, load),
  );
  const leaf = registry.plugin.app.workspace.getLeaf(true);
  const open = () => leaf.setViewState({ type: SHELL_VIEW_TYPE, state: { route: start } });
  return { leaf, open, runtime, surfaces };
}

it("mounts once, keeps native navigation off, and closes its registered surface", async () => {
  const close = vi.fn<() => void>();
  const mountSurface = vi.fn<Mount>().mockResolvedValue(close);
  const load = vi.fn<SurfaceLoader>().mockResolvedValue({ mountSurface });
  const { leaf, open, runtime, surfaces } = testView(load);

  try {
    await open();
    await open();
    expect(load).toHaveBeenCalledOnce();
    expect(mountSurface).toHaveBeenCalledOnce();
    expect(leaf.view?.navigation).toBe(false);
    expect(leaf.view?.getDisplayText()).toBe("Product Engineering");
    expect(surfaces.size).toBe(1);
    await leaf.detach();
    expect(surfaces.size).toBe(0);
    expect(close).toHaveBeenCalledOnce();
  } finally {
    await leaf.detach();
    await runtime.dispose();
  }
});

it("abandons the load when the view closes while its loader is pending", async () => {
  const loaded = deferred<MountedSurface>();
  const mountSurface = vi.fn<Mount>();
  const load = vi.fn<SurfaceLoader>(() => loaded.ready);
  const { leaf, open, runtime, surfaces } = testView(load);
  const opening = open();

  try {
    await eventually(() => expect(load).toHaveBeenCalledOnce());
    expect(surfaces.size).toBe(1);
    await leaf.detach();
    expect(surfaces.size).toBe(0);
    loaded.resolve({ mountSurface });
    await expect(opening).resolves.toBeUndefined();
    expect(mountSurface).not.toHaveBeenCalled();
  } finally {
    loaded.resolve({ mountSurface });
    await leaf.detach();
    await runtime.dispose();
  }
});

it("closes a surface that settles after the view has already closed", async () => {
  const mounting = deferred<() => void>();
  const close = vi.fn<() => void>();
  const mountSurface = vi.fn<Mount>(() => mounting.ready);
  const load = vi.fn<SurfaceLoader>().mockResolvedValue({ mountSurface });
  const { leaf, open, runtime, surfaces } = testView(load);
  const opening = open();

  try {
    await eventually(() => expect(mountSurface).toHaveBeenCalledOnce());
    await leaf.detach();
    expect(surfaces.size).toBe(0);
    mounting.resolve(close);
    await expect(opening).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  } finally {
    mounting.resolve(close);
    await leaf.detach();
    await runtime.dispose();
  }
});

it("closes the bootstrapped view before the managed runtime is disposed", async () => {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  const handle = await bootstrap(plugin, { signal: new AbortController().signal });
  const leaf = registry.plugin.app.workspace.getLeaf(true);
  const disposeRuntime = handle.runtime.dispose.bind(handle.runtime);

  try {
    await leaf.setViewState({ type: SHELL_VIEW_TYPE });
    expect(leaf.view?.contentEl.querySelector('[data-testid="app-frame"]')).toBeTruthy();
    const dispose = vi.spyOn(handle.runtime, "dispose").mockImplementation(async () => {
      expect(leaf.view?.contentEl.childElementCount).toBe(0);
      await disposeRuntime();
    });
    await handle.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  } finally {
    await leaf.detach();
    await disposeRuntime();
  }
});
