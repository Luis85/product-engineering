import { _api, loadIcons } from "@iconify/vue";
import { expect, it, vi } from "vitest";
import { keepIconsOffline } from "../../../../src/presentation/shell/icons-offline";

it("rejects the Iconify batch for a missing icon without reaching the network", async () => {
  const transport = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 404 })));
  _api.setFetch(transport);
  keepIconsOffline();

  try {
    const missing = await new Promise<readonly { prefix: string; name: string }[]>((resolve) => {
      loadIcons(["scope-offline-test:missing"], (_loaded, unavailable) => resolve(unavailable));
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    expect(missing).toContainEqual(
      expect.objectContaining({ prefix: "scope-offline-test", name: "missing" }),
    );
    expect(transport).not.toHaveBeenCalled();
  } finally {
    _api.setFetch(globalThis.fetch);
  }
});
