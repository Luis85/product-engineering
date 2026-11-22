import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { loadSurface } from "../../src/presentation/shell/host";
import { testRuntime } from "../support/runtime";

const evaluated = vi.hoisted(() => ({
  vue: vi.fn<() => void>(),
  nuxt: vi.fn<() => void>(),
  form: vi.fn<() => void>(),
}));

vi.mock("obsidian", () => import("@test/obsidian"));
vi.mock("vue", async (original) => {
  evaluated.vue();
  return original<typeof import("vue")>();
});
vi.mock("@nuxt/ui/vue-plugin", async (original) => {
  evaluated.nuxt();
  return original<typeof import("@nuxt/ui/vue-plugin")>();
});
vi.mock("@tanstack/vue-form", async (original) => {
  evaluated.form();
  return original<typeof import("@tanstack/vue-form")>();
});

it("loads the plugin without evaluating Vue, Nuxt UI or TanStack Form", async () => {
  const { default: ShellPlugin } = await import("../../src/main");
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  const fixture = testRuntime();
  const root = document.createElement("div");
  document.body.append(root);
  let close: (() => void) | undefined;
  try {
    await registry.load();
    expect(evaluated.vue).not.toHaveBeenCalled();
    expect(evaluated.nuxt).not.toHaveBeenCalled();
    expect(evaluated.form).not.toHaveBeenCalled();

    const { mountSurface } = await loadSurface();
    close = await mountSurface(root, fixture.runtime, {
      content: { render: () => "Lazy surface" },
    });
    expect(root.textContent).toContain("Lazy surface");
    expect(evaluated.vue).toHaveBeenCalledOnce();
    expect(evaluated.nuxt).toHaveBeenCalledOnce();
    expect(evaluated.form).not.toHaveBeenCalled();
  } finally {
    close?.();
    root.remove();
    plugin.unload();
    await fixture.runtime.dispose();
  }
}, 60_000);
