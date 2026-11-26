import ui from "@nuxt/ui/vue-plugin";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { Messages } from "../../../../src/application/shell";
import type { UserMessage } from "../../../../src/application/shell";
import { ErrorNotice } from "../../../../src/presentation/shell";
import { provideRuntime } from "../../../../src/presentation/shell/runtime/use-runtime";
import { testRuntime } from "../../../support/runtime";

const failure: UserMessage = {
  severity: "error",
  title: "The note could not be saved",
  detail: "Your changes are still in the form.",
  action: "retry",
  link: "https://github.com/Luis85/product-engineering/issues",
};

async function noticeFixture(
  message: UserMessage,
  handlers?: { retry: () => void | Promise<void> },
) {
  const fixture = testRuntime({ language: "en" });
  await fixture.runtime.runPromise(Messages);
  const wrapper = mount(ErrorNotice, {
    attachTo: document.body,
    props: { message, ...(handlers ? { handlers } : {}) },
    global: { plugins: [ui, (app) => provideRuntime(app, fixture.runtime)] },
  });
  return {
    ...fixture,
    wrapper,
    async close() {
      wrapper.unmount();
      await fixture.runtime.dispose();
    },
  };
}

it("announces title and detail and renders the issues link without an unsupported action", async () => {
  const fixture = await noticeFixture(failure);
  try {
    const alert = fixture.wrapper.get("[role='alert']");
    expect(alert.text()).toContain(failure.title);
    expect(alert.text()).toContain(failure.detail);
    const link = alert.get("a");
    expect(link.attributes()).toMatchObject({
      href: failure.link,
      target: "_blank",
      rel: "noopener",
    });
    expect(link.text()).toBe("Report issues on GitHub");
    expect(alert.find("button").exists()).toBe(false);
  } finally {
    await fixture.close();
  }
});

it("keeps the focused action operable for assistive tech while blocking double activation", async () => {
  let finish: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const retry = vi.fn<() => Promise<void>>().mockReturnValue(pending);
  const fixture = await noticeFixture(failure, { retry });
  try {
    const button = fixture.wrapper.get("button");
    expect(button.text()).toBe("Retry");
    button.element.focus();
    await button.trigger("click");
    expect(button.attributes("aria-disabled")).toBe("true");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(document.activeElement).toBe(button.element);
    await button.trigger("click");
    expect(retry).toHaveBeenCalledOnce();
    finish?.();
    await flushPromises();
    expect(button.attributes("aria-disabled")).toBeUndefined();
  } finally {
    finish?.();
    await fixture.close();
  }
});

it("copies diagnostics when no custom handler is supplied", async () => {
  const fixture = await noticeFixture({ ...failure, action: "copy-diagnostics" });
  try {
    const button = fixture.wrapper.get("button");
    expect(button.text()).toBe("Copy diagnostics");
    await button.trigger("click");
    await flushPromises();
    expect(fixture.clipboard).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});
