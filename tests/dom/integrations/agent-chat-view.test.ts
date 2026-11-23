import { beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { AGENT_CHAT, ProviderChatError } from "../../../src/application/integrations";
import type { ProviderChat } from "../../../src/application/integrations";
import { catalogFor } from "../../../src/application/messages";
import { appSurface } from "../../../src/presentation/app-surface";
import { agentChat } from "../../../src/presentation/integrations";
import { mountSurface } from "../../../src/presentation/shell";
import { testRuntime } from "../../support/runtime";
import { eventually } from "../../support/wait";

const stream = vi.hoisted(() => vi.fn<ProviderChat["stream"]>());

vi.mock("../../../src/presentation/integrations/use-provider-chat", () => ({
  useProviderChat: () => ({ stream }),
}));
beforeEach(() => {
  stream.mockReset();
});

function latch() {
  let resolve: (() => void) | undefined;
  const ready = new Promise<void>((release) => {
    resolve = release;
  });
  return { ready, release: () => resolve?.() };
}

function find<E extends Element>(root: HTMLElement, selector: string): E {
  const element = root.querySelector<E>(selector);
  if (!element) throw new Error(`Expected chat element ${selector}`);
  return element;
}

async function fixture(aiEnabled = true) {
  const { runtime } = testRuntime({ language: "en", initialSettings: { aiEnabled } });
  const root = document.body.appendChild(document.createElement("div"));
  try {
    const content = defineComponent({ render: () => h(agentChat) });
    const close = await mountSurface(root, runtime, { content });
    return {
      root,
      close,
      async dispose() {
        close();
        root.remove();
        await runtime.dispose();
      },
    };
  } catch (error) {
    root.remove();
    await runtime.dispose();
    throw error;
  }
}

function setText(root: HTMLElement, value: string) {
  const field = find<HTMLTextAreaElement>(root, "textarea");
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return nextTick();
}

function choose(root: HTMLElement, value: string) {
  const select = find<HTMLSelectElement>(root, "select");
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return nextTick();
}

function submit(root: HTMLElement) {
  find<HTMLFormElement>(root, "form").dispatchEvent(new Event("submit", { cancelable: true }));
}

it("preserves the chat route while keeping it out of default navigation", async () => {
  const route = appSurface.decode({ name: AGENT_CHAT });
  expect(route).toEqual({ name: AGENT_CHAT });
  const menu = appSurface.menu.find((entry) => entry.route.name === AGENT_CHAT);
  expect(menu).toBeUndefined();
  expect(catalogFor("de").integrations.chat.title).toBe("KI-Chat");
  await expect(appSurface.screen(route)?.()).resolves.toBe(agentChat);
});

it("hides send controls on a saved chat route without consent", async () => {
  const view = await fixture(false);
  try {
    expect(view.root.querySelector("form")).toBeNull();
    expect(view.root.textContent).toContain("AI is disabled");
    expect(stream).not.toHaveBeenCalled();
  } finally {
    await view.dispose();
  }
});

it("guards a blank or overlapping submit and renders the streamed response as plain text", async () => {
  const finish = latch();
  stream.mockImplementation(async function* () {
    yield "<em data-probe>You have";
    await finish.ready;
    yield " a reply</em>";
  });
  const view = await fixture();
  try {
    const send = find<HTMLButtonElement>(view.root, "button[type=submit]");
    expect(send.getAttribute("aria-disabled")).toBe("true");
    expect(send.disabled).toBe(false);
    submit(view.root);
    expect(stream).not.toHaveBeenCalled();
    await choose(view.root, "claude-code");
    await setText(view.root, "  Check the response");
    submit(view.root);
    const log = find(view.root, "[role=log]");
    await eventually(() => expect(log.textContent).toContain("<em data-probe>You have"));
    expect(log.getAttribute("aria-busy")).toBe("true");
    expect(view.root.querySelector("[data-probe]")).toBeNull();
    expect(send.getAttribute("aria-disabled")).toBe("true");
    await setText(view.root, "another draft");
    submit(view.root);
    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream.mock.calls[0]?.[0]).toEqual({
      provider: "claude-code",
      messages: [{ role: "user", content: "  Check the response" }],
    });

    finish.release();
    await eventually(() => expect(log.getAttribute("aria-busy")).toBe("false"));
    expect(log.textContent).toContain("<em data-probe>You have a reply</em>");
    expect(view.root.querySelector("textarea")?.value).toBe("another draft");
  } finally {
    finish.release();
    await view.dispose();
  }
});

it("keeps the partial reply and focused Stop control after cancellation", async () => {
  const finish = latch();
  stream.mockImplementation(async function* () {
    yield "Partial";
    await finish.ready;
    yield "late data";
  });
  const view = await fixture();
  try {
    await setText(view.root, "Start reply");
    submit(view.root);
    const log = find(view.root, "[role=log]");
    await eventually(() => expect(log.textContent).toContain("Partial"));
    const stop = find<HTMLButtonElement>(view.root, "[data-testid=stop-response]");
    stop.focus();
    stop.click();
    await nextTick();
    expect(stop.getAttribute("aria-disabled")).toBe("true");
    expect(stop.disabled).toBe(false);
    expect(stream.mock.calls[0]?.[1]?.aborted).toBe(true);
    finish.release();
    await eventually(() => expect(view.root.textContent).toContain("Response stopped"));
    expect(log.textContent).toContain("Partial");
    expect(log.textContent).not.toContain("late data");
    expect(document.activeElement).toBe(stop);
  } finally {
    finish.release();
    await view.dispose();
  }
});

it.each(["", "Keep editing while waiting"])(
  "shows the provider that failed and preserves the draft %j",
  async (draft) => {
    const finish = latch();
    stream.mockImplementation(async function* ({ provider }) {
      yield "Partial";
      await finish.ready;
      throw new ProviderChatError({ provider, reason: "authentication-required" });
    });
    const view = await fixture();
    try {
      await choose(view.root, "claude-code");
      await setText(view.root, "Previous message");
      submit(view.root);
      await eventually(() => expect(view.root.textContent).toContain("Partial"));
      await choose(view.root, "codex");
      await setText(view.root, draft);
      finish.release();
      await eventually(() =>
        expect(view.root.querySelector("[role=alert]")?.textContent).toContain(
          "Claude Code needs you to sign in",
        ),
      );
      expect(view.root.textContent).toContain("Sign in through the installed CLI");
      await eventually(() =>
        expect(view.root.querySelector("textarea")?.value).toBe(draft || "Previous message"),
      );
    } finally {
      finish.release();
      await view.dispose();
    }
  },
);

it("aborts any active stream when the view closes", async () => {
  const finish = latch();
  stream.mockImplementation(async function* () {
    yield "Partial";
    await finish.ready;
  });
  const view = await fixture();
  try {
    await setText(view.root, "Hello");
    submit(view.root);
    await eventually(() => expect(view.root.textContent).toContain("Partial"));
    view.close();
    expect(stream.mock.calls[0]?.[1]?.aborted).toBe(true);
    expect(view.root.childElementCount).toBe(0);
  } finally {
    finish.release();
    await view.dispose();
  }
});
