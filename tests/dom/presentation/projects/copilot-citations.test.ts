import { expect, it } from "vitest";
import { loadCopilot, saveCopilot } from "../../../../src/application/integrations";
import { eventually } from "../../../support/wait";
import { fillPrompt, primary, send, task, unrelated, withReview } from "./copilot-fixture";
import { find, first } from "./knowledge-fixture";

const source = "knowledge:" + primary;
const sibling = "knowledge:" + unrelated;
const citation = "[data-testid=copilot-source-link]";

function replySources(panel: HTMLElement, content: string) {
  const message = [...panel.querySelectorAll("[role=log] > li")].find((entry) =>
    entry.textContent?.includes(content),
  );
  if (!message) throw new Error("Expected the controlled reply in the transcript");
  return [...message.querySelectorAll(citation)].map((link) =>
    link.getAttribute("data-source-key"),
  );
}

it("keeps the first and second reply's exact citations in one scoped thread after reload", () =>
  withReview(async ({ host, panel, stream, mount, reopen }) => {
    stream
      .mockImplementationOnce(async function* () {
        yield "First documented result";
      })
      .mockImplementationOnce(async function* () {
        yield "Second documented result";
      });
    fillPrompt(panel, "Review the saved PRD");
    send(panel);
    await eventually(() =>
      expect(replySources(panel, "First documented result")).toEqual([source]),
    );
    fillPrompt(panel, "Review the remaining decision");
    send(panel);
    await eventually(async () => {
      const saved = await host.runtime.runPromise(loadCopilot(first));
      expect(saved?.threads[0]?.messages).toHaveLength(4);
    });
    const history = stream.mock.calls[1]?.[0].messages.slice(0, 2);
    expect(history).toEqual([
      { role: "user", content: "Review the saved PRD" },
      { role: "assistant", content: "First documented result" },
    ]);
    await mount();
    const restored = await reopen();
    await eventually(() =>
      expect(replySources(restored, "Second documented result")).toEqual([source]),
    );
    expect(replySources(restored, "First documented result")).toEqual([source]);
    expect(stream).toHaveBeenCalledTimes(2);
  }));

it("keeps each reply tied to its own selected source when a thread's context is edited", () =>
  withReview(async ({ host, panel, stream }) => {
    stream
      .mockImplementationOnce(async function* () {
        yield "Handover-specific reply";
      })
      .mockImplementationOnce(async function* () {
        yield "Sibling-specific reply";
      });
    fillPrompt(panel, "Review the original");
    send(panel);
    await eventually(() =>
      expect(replySources(panel, "Handover-specific reply")).toEqual([source]),
    );
    task(panel, "ask");
    find<HTMLInputElement>(panel, `input[data-testid=copilot-source][value="${source}"]`).click();
    find<HTMLInputElement>(panel, `input[data-testid=copilot-source][value="${sibling}"]`).click();
    fillPrompt(panel, "Ask about the selected sibling");
    send(panel);
    await eventually(() =>
      expect(replySources(panel, "Sibling-specific reply")).toEqual([sibling]),
    );
    expect(replySources(panel, "Handover-specific reply")).toEqual([source]);
    expect(JSON.stringify(stream.mock.calls[1]?.[0])).toContain("Private body: Unselected sibling");
    expect(JSON.stringify(stream.mock.calls[1]?.[0])).not.toContain("Private body: Exact handover");
    const stored = await host.runtime.runPromise(loadCopilot(first));
    expect(stored?.threads[0]?.messages).toEqual([
      { role: "user", content: "Review the original" },
      { role: "assistant", content: "Handover-specific reply", sources: [source] },
      { role: "user", content: "Ask about the selected sibling" },
      { role: "assistant", content: "Sibling-specific reply", sources: [sibling] },
    ]);
  }));

it("shows legacy reply text without guessing its citations from the thread's current selection", () =>
  withReview(async ({ host, mount, reopen, stream }) => {
    const id = "legacy-thread";
    await host.runtime.runPromise(
      saveCopilot(first, {
        composer: {
          activeId: id,
          mode: "review",
          target: source,
          selected: [source],
          prompt: "",
          locked: true,
        },
        thread: {
          id,
          selected: [source],
          messages: [
            { role: "user", content: "Historical review" },
            { role: "assistant", content: "Historical reply without attribution" },
          ],
        },
      }),
    );
    await mount();
    const restored = await reopen();
    await eventually(() =>
      expect(find(restored, "[role=log]").textContent).toContain(
        "Historical reply without attribution",
      ),
    );
    await eventually(() =>
      expect(find(restored, "[data-testid=copilot-selected-sources]").textContent).toContain(
        "Exact handover",
      ),
    );
    expect(replySources(restored, "Historical reply without attribution")).toEqual([]);
    expect(stream).not.toHaveBeenCalled();
  }));
