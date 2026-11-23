import { Effect, Layer } from "effect";
import { expect, it, vi } from "vitest";
import { ArtifactGit, ArtifactGitError } from "../../../../src/application/git";
import type { GitArtifactTarget, GitFile, GitJournal } from "../../../../src/application/git";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { eventually } from "../../../support/wait";
import { find, first, jobOne, seedFoundations, withProject } from "./knowledge-fixture";

const notePath = "Projects/Kundenportal/JOB-12.md";
const initial = "1".repeat(40);
const next = "2".repeat(40);
const source = (text: string): GitFile => ({
  path: notePath,
  bytes: new TextEncoder().encode(text),
});
const latest = source("Shared\nAfter\n");
const previous = source("Shared\nBefore\n");
const revision = {
  oid: initial,
  path: notePath,
  message: "Original version",
  parents: [],
  author: "Fixture",
  time: "2026-11-22T10:00:00Z",
};
const initialJournal: GitJournal = {
  state: "changed",
  worktree: "/repo",
  ref: "refs/heads/main",
  head: initial,
  current: latest,
  base: previous,
  revisions: [revision],
};
const selector = (name: string) => '[data-testid="' + name + '"]';

function boot(seed = initialJournal) {
  let journal = seed;
  let inspectIssue = true;
  let compareIssue = true;
  let commitIssue = true;
  const inspect = vi.fn<(typeof ArtifactGit.Service)["inspect"]>((_target: GitArtifactTarget) =>
    Effect.suspend(() =>
      inspectIssue
        ? Effect.fail(new ArtifactGitError({ reason: "repository" }))
        : Effect.succeed(journal),
    ),
  );
  const compare = vi.fn<(typeof ArtifactGit.Service)["compare"]>(
    (_target: GitArtifactTarget, oid: string) =>
      Effect.suspend(() => {
        if (compareIssue) return Effect.fail(new ArtifactGitError({ reason: "git" }));
        return Effect.succeed(
          oid === initial
            ? { current: previous, base: undefined, parent: undefined, merge: false }
            : { current: latest, base: previous, parent: initial, merge: true },
        );
      }),
  );
  const commit = vi.fn<(typeof ArtifactGit.Service)["commit"]>(
    (_target: GitArtifactTarget, _snapshot: GitJournal, _message: string) =>
      Effect.suspend(() => {
        if (commitIssue) return Effect.fail(new ArtifactGitError({ reason: "conflict" }));
        journal = {
          ...initialJournal,
          state: "clean",
          head: next,
          base: latest,
          revisions: [
            { ...revision, oid: next, message: "New revision", parents: [initial] },
            revision,
          ],
        };
        return Effect.succeed(next);
      }),
  );
  return {
    layer: Layer.succeed(ArtifactGit, {
      inspect,
      compare,
      commit,
      readRevision: () => Effect.succeed(previous),
    }),
    inspect,
    compare,
    commit,
    recoverInspect: () => {
      inspectIssue = false;
    },
    recoverCompare: () => {
      compareIssue = false;
    },
    recoverCommit: () => {
      commitIssue = false;
    },
    changeWorking: () => {
      journal = { ...journal, current: source("Shared\nExternal disk bytes\n") };
    },
  };
}

it("shows the first missing worktree and retries to recover the real scoped History panel", async () => {
  const git = boot();
  await withProject(
    async ({ host, navigation, root }) => {
      await seedFoundations(host);
      await navigation.navigate(knowledgeDetailRoute(first, jobOne));
      await eventually(() => find(root, selector("knowledge-history-tab"))).then((button) =>
        button.click(),
      );
      const compare = await eventually(() => find(root, selector("git-comparison")));
      await eventually(() => expect(compare.textContent).toContain("working tree"));
      git.recoverInspect();
      find(compare, "button").click();
      await eventually(() => expect(compare.textContent).toContain("+ After"));
      expect(git.inspect.mock.lastCall?.[0]).toEqual({
        projectId: first,
        path: notePath,
        branch: "main",
        repository: "produktteam/kundenportal",
      });
      const versions = find(root, selector("git-versions"));
      const selected = find(versions, '[data-git-oid="' + initial + '"]');
      selected.click();
      await eventually(() => expect(compare.textContent).toContain("could not complete"));
      expect(selected.getAttribute("aria-pressed")).toBe("true");
      git.recoverCompare();
      find(compare, "button").click();
      await eventually(() => expect(compare.textContent).toContain("New file"));
      git.changeWorking();
      find(versions, selector("git-working")).click();
      await eventually(() => expect(compare.textContent).toContain("+ External disk bytes"));
      await eventually(() => expect(compare.textContent).toContain("- Before"));
    },
    undefined,
    git.layer,
  );
});

it("keeps approval and dirty state separate, validates a commit and preserves its draft through review", async () => {
  const git = boot();
  git.recoverInspect();
  git.recoverCompare();
  await withProject(
    async ({ host, navigation, root }) => {
      await seedFoundations(host);
      await navigation.navigate(knowledgeDetailRoute(first, jobOne));
      const button = (name: string) => find<HTMLButtonElement>(root, selector(name));
      const field = () => find<HTMLInputElement>(root, "[name=message]");
      const submit = () => find(root, selector("git-commit-form") + " button[type=submit]").click();
      await eventually(() => button("knowledge-edit")).then((control) => control.click());
      const editor = await eventually(() => find<HTMLTextAreaElement>(root, "[name=markdown]"));
      editor.value = "Pending exact text";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      (await eventually(() => button("git-save-and-commit"))).click();
      await eventually(field);
      submit();
      await eventually(() => expect(field().getAttribute("aria-invalid")).toBe("true"));
      field().value = "Review and commit";
      field().dispatchEvent(new Event("input", { bubbles: true }));
      submit();
      await eventually(() => expect(button("git-commit-error").textContent).toContain("changed"));
      expect(git.commit).toHaveBeenCalledTimes(1);

      button("git-review-current").click();
      await eventually(() =>
        expect(find(root, selector("git-comparison")).textContent).toContain("+ After"),
      );
      git.recoverCommit();
      (await eventually(() => button("git-commit"))).click();
      expect((await eventually(field)).value).toBe("Review and commit");
      submit();
      await eventually(() =>
        expect(button("git-announcement").textContent).toContain(next.slice(0, 8)),
      );
      expect(find(root, '[data-git-oid="' + next + '"]').getAttribute("aria-pressed")).toBe("true");
      expect(find(root, selector("git-comparison")).textContent).toContain("First parent");
      expect(find(root, selector("knowledge-note-header")).textContent).toContain("Approved");
      expect(host.notes.body(notePath)).toBe("Pending exact text");
    },
    undefined,
    git.layer,
  );
});

it("navigates to a later change page without losing the first hunk", async () => {
  const lines = Array.from({ length: 600 }, (_, index) => "Line " + (index + 1));
  const saved = [...lines];
  saved[9] = "First changed paragraph";
  saved[499] = "Later changed paragraph";
  const git = boot({
    ...initialJournal,
    base: source(lines.join("\n")),
    current: source(saved.join("\n")),
  });
  git.recoverInspect();
  await withProject(
    async ({ host, navigation, root }) => {
      await seedFoundations(host);
      await navigation.navigate(knowledgeDetailRoute(first, jobOne));
      (await eventually(() => find(root, selector("knowledge-history-tab")))).click();
      const panel = await eventually(() => find(root, selector("git-comparison")));
      await eventually(() => expect(panel.textContent).toContain("+ First changed paragraph"));
      const nextPage = find<HTMLButtonElement>(panel, selector("git-diff-next"));
      expect(nextPage.disabled).toBe(false);
      expect(panel.textContent).not.toContain("+ Later changed paragraph");
      nextPage.click();
      await eventually(() => expect(panel.textContent).toContain("+ Later changed paragraph"));
      expect(nextPage.disabled).toBe(true);
      find(panel, selector("git-diff-previous")).click();
      await eventually(() => expect(panel.textContent).toContain("+ First changed paragraph"));
    },
    undefined,
    git.layer,
  );
});
