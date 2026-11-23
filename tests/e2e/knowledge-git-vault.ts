import { browser } from "@wdio/globals";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fixtureGitEnv } from "../support/git-fixture";
import { seedKnowledgeDetailVault } from "./knowledge-detail-vault";
import { customerFolder } from "./knowledge-vault";

export const trackedNote = "PRD-03.md";
export const otherFile = "Other state.md";
export const untrackedFile = "Untracked evidence.md";
export const fixtureAuthor = "Vault Fixture";
export const originalMessage = "Ausgangsstand im Vault erfasst";
export const secondMessage = "Arbeitsablauf präzisiert";

export async function seedKnowledgeGitVault() {
  await seedKnowledgeDetailVault();
  const vault = browser.getObsidianPage().getVaultPath();
  const cwd = join(vault, customerFolder);
  if (existsSync(join(cwd, ".git")) || relative(process.cwd(), vault) === "") {
    throw new Error("The Git fixture requires a fresh copied vault");
  }
  const env = fixtureGitEnv(join(cwd, ".git", "no-global-config"));
  const git = (...args: string[]) =>
    execFileSync("git", ["--literal-pathspecs", ...args], { cwd, env });
  const read = (path: string) => readFileSync(join(cwd, path));
  const write = (path: string, contents: string) => writeFileSync(join(cwd, path), contents);
  const head = () => git("rev-parse", "HEAD").toString().trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", fixtureAuthor);
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.autocrlf", "false");
  const firstBytes = read(trackedNote);
  write(otherFile, "Baseline file\n");
  git("add", "--", trackedNote, otherFile);
  git("commit", "--quiet", "-m", originalMessage);
  const initial = head();
  const revised =
    firstBytes.toString().replace("## Problem", "## Kundenproblem") + "\nNeue Übergaberegel.\n";
  await browser.executeObsidian(
    async ({ app }, path, text) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing seeded Git note");
      await app.vault.modify(file, text);
    },
    customerFolder + "/" + trackedNote,
    revised,
  );
  git("add", "--", trackedNote);
  git("commit", "--quiet", "-m", secondMessage);
  const second = head();
  write(otherFile, "Staged independently\n");
  git("add", "--", otherFile);
  write(otherFile, "Unstaged independently\n");
  write(untrackedFile, "Outside this commit\n");
  return {
    cwd,
    git,
    head,
    read,
    write,
    firstBytes,
    initial,
    second,
    stagedOther: git("show", ":" + otherFile),
  };
}
