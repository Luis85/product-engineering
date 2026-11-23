# GitHub setup

| Workflow | Trigger | Verification |
| --- | --- | --- |
| `ci.yml` | Pull requests and pushes to `main` | Runs the repository gate and Obsidian desktop suite. The scanner preview is informational. |
| `nightly-mutation.yml` | Daily at 02:17 UTC and by manual dispatch | Runs the gated and informational mutation suites, saves their caches and reports, and opens or updates an issue on failure. |
| `release.yml` | Manual dispatch on `main` or a bare version tag | Builds and tests in a read-only job. A separate publish job attests and releases the artifact. |

Actionlint 1.7.12 checked all three workflow files locally. The release and nightly workflows need the GitHub Actions runner for live validation. Their first dispatched runs are recorded as `not-run` until the repository owner performs them.

The Obsidian cache key comes from the WDIO configuration, loaded through the `tsx` loader in the locked WDIO toolchain. The local cache-key smoke test resolved app and installer version `1.15.1` on Node 24.22.3. The Obsidian download is stored in the Actions cache.

The local scanner preview on the initial checkout returned exit 1 with 15 errors and 92 warnings. All errors came from the tracked Archify HTML reader under `.claude/skills`. The CI scanner check is advisory. [Obsidian community scanner configuration](https://raw.githubusercontent.com/obsidianmd/eslint-plugin/0.6.0/docs/configuration.md#community-plugin-scanner-configuration)

## Dependency and action updates

- Use the gate for minor and patch updates. Read the changelog and [ADR 0001](../adr/0001-dependency-baseline.md) before a major update.
- Remove a dependency override by hand once the affected parents require a patched dependency.
- Keep the release tag comment beside every action SHA. Verify the new SHA with `git ls-remote` and check the release notes between the two tags against the inputs used here.
- Verify each action update in CI and review its effect on the workflows outside pull requests. Release depends on checkout, Node setup, caching, artifact upload and download, and provenance attestation. Nightly mutation depends on checkout, Node setup, incremental cache restore and save, and artifact upload.
- A bundled package change can fail `check:notices`. Regenerate and commit the notices with `npm run notices`, and name the license for each new bundled package in the pull request.

## Repository-owner setup

These steps are recorded as `not-run` in the local implementation.

1. Enable Actions under **Settings → Actions → General**. The read-only default token is sufficient. The release job requests its publish and attestation permissions explicitly. Artifact attestations require a public repository or GitHub Enterprise Cloud for private repositories. [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
2. Create a ruleset for `main` under **Settings → Rules → Rulesets**. Require a pull request with at least one approval, require **CI / verify** after it appears, block force pushes, and allow squash merges. Add **CI / e2e** after about two weeks of stable runs.
3. Verify the ruleset with a pull request that adds `const x: number = "a";` to a domain file. Confirm the failed verify check blocks merging, then close the pull request.
4. When a release is authorized, follow [Releasing](releasing.md) and watch the first workflow run. Dispatch the nightly workflow and confirm its next run restores the saved incremental cache.
