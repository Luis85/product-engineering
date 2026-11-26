import { browser } from "@wdio/globals";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { newNoteText } from "../../src/domain/notes";
import { fixtureGitEnv } from "../support/git-fixture";
import { exportPath, seedBacklogVault, work } from "./backlog-vault";
import { customerFolder, customerProject, customerRequirement, jobOne } from "./knowledge-vault";

export const pbiId = "UC-09";
export const pbiTitle = "Gefilterte Servicefälle exportieren";
export const pbiResearch = "knowledge-33333333-3333-4333-8333-000000000041";
export const pbiDeclaration = exportPath.substring(customerFolder.length + 1);

export async function seedPbiVault(requirement = "REQ-03") {
  await seedBacklogVault();
  const facts = [
    "schema: product-engineering.backlog/v1",
    "id: backlog-33333333-3333-4333-8333-000000000009",
    "project_id: " + customerProject,
    "pe-id: " + pbiId,
    "pbi_prd_id: " + customerRequirement,
    "pbi_requirement_id: " + requirement,
    "pbi_job_id: " + jobOne,
    "pbi_research_id: " + pbiResearch,
  ].join("\n");
  await browser.executeObsidian(
    async ({ app }, path, extra, researchPath, research) => {
      const pbi = app.vault.getFileByPath(path);
      if (!pbi) throw new Error("Missing canonical PBI fixture");
      await app.vault.process(pbi, (original) => original.replace("---\n", "---\n" + extra + "\n"));
      await app.vault.create(researchPath, research);
    },
    exportPath,
    facts,
    customerFolder + "/RES-02.md",
    newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        id: pbiResearch,
        project_id: customerProject,
        display_id: "RES-02",
        title: "CSV-Export im Serviceprozess",
        kind: "research",
        approval: "approved",
      },
      "\n## Beobachtung\n\nDas Serviceteam benötigt gefilterte Treffer.\n",
    ),
  );
  const vault = browser.getObsidianPage().getVaultPath();
  const cwd = join(vault, customerFolder);
  if (!relative(process.cwd(), vault) || existsSync(join(cwd, ".git")))
    throw new Error("PBI Git tests require a fresh copied vault");
  const env = fixtureGitEnv(join(cwd, ".git", "no-global-config"));
  const git = (...args: string[]) =>
    execFileSync("git", ["--literal-pathspecs", ...args], { cwd, env })
      .toString()
      .trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "PBI Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.autocrlf", "false");
  git("config", "core.quotePath", "false");
  git("add", "--", pbiDeclaration, "PRD-03.md", "VIS-01.md", "RES-02.md", "JOB-12.md");
  git("commit", "--quiet", "-m", "PBI and source baseline");
  return { git, baseline: git("rev-parse", "HEAD") };
}

export function pbiChildren() {
  return browser.executeObsidian(
    ({ app }, folder, title) =>
      app.vault
        .getMarkdownFiles()
        .filter(
          (file) =>
            file.path.startsWith(folder + "/") &&
            String(app.metadataCache.getFileCache(file)?.frontmatter?.parent ?? "").includes(title),
        )
        .map((file) => ({
          path: file.path,
          id: String(app.metadataCache.getFileCache(file)?.frontmatter?.["pe-id"] ?? ""),
        })),
    work,
    pbiTitle,
  );
}
