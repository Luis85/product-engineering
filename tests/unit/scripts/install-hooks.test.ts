import { describe, expect, it, vi } from "vitest";
import { installHooks } from "../../../scripts/install-hooks.mjs";

type Git = Parameters<typeof installHooks>[1];

describe("Git hook installation", () => {
  it.each(["CI", "TF_BUILD", "GITHUB_ACTIONS"])("skips a build with %s set", (flag) => {
    const git = vi.fn<Git>();

    expect(installHooks({ [flag]: "1" }, git)).toBe("skipped: CI");
    expect(git).not.toHaveBeenCalled();
  });

  it("skips outside a Git worktree", () => {
    const git = vi.fn<Git>(() => ({ status: 128, stdout: "" }));

    expect(installHooks({}, git)).toBe("skipped: no git");
    expect(git).toHaveBeenCalledExactlyOnceWith(["rev-parse", "--is-inside-work-tree"]);
  });

  it("sets the hook directory inside a Git worktree", () => {
    const git = vi
      .fn<Git>()
      .mockReturnValueOnce({ status: 0, stdout: "true\n" })
      .mockReturnValueOnce({ status: 0, stdout: "" });

    expect(installHooks({}, git)).toBe("installed");
    expect(git).toHaveBeenLastCalledWith(["config", "core.hooksPath", ".githooks"]);
  });
});
