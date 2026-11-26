# Releasing Product Engineering

Publish only when the repository owner asks for a release. Use a bare `x.y.z` version such as `0.2.0`. Raise `minAppVersion` before a bump that requires a newer Obsidian API.

## Plan the release

Run the read-only planner with `current`, `patch`, `minor`, `major`, or a bare version. The JSON output gives agents the current version, proposed version, and whether a version PR is required. The planner checks that the package and lockfile agree with the manifest.

```sh
npm run --silent release:plan -- minor
```

Use `current` to release the version already on `main`. When the plan proposes a different version, prepare and merge the version PR before dispatching the workflow.

## Prepare the version

1. Update `main`, then create a release branch.

   ```sh
   git switch main
   git pull --ff-only
   git switch -c chore/release-0.2.0
   npm version 0.2.0 --no-git-tag-version
   ```

2. Commit `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` as `chore: release 0.2.0`. The version hook updates and stages `manifest.json` and `versions.json`. Run `npm run verify` and merge the changes through a pull request.
3. Confirm CI is green on `main`, then start the release on the merged commit.

## Check the release

Dispatch **Release** on `main` with `dry_run=true` to run the same build, Obsidian tests, and packaging used for publication. The run summary records the tag, source commit, and channel. Download the `release-files` artifact to inspect the staged assets.

```sh
gh workflow run release.yml --ref main -f version=current -F dry_run=true
```

## Publish the release

After the owner approves publication, open **Actions → Release → Run workflow** and select `main`. Set `version` to `current` or the exact merged version. Keep **Prerelease** off for the Community Plugins directory. Set it for a beta release.

```sh
gh workflow run release.yml --ref main -f version=current -F prerelease=false -F dry_run=false
```

Follow the run in Actions. Confirm the release tag against `manifest.json` and check the individual assets on the release page. Pushing a bare tag on a commit already on `origin/main` is also supported. Tag-triggered `0.x` releases are prereleases. The manual workflow can publish the same version range as a regular release.

```sh
git fetch origin main
git tag 0.2.0 origin/main
git push origin 0.2.0
```

Where direct updates to `main` are allowed, `npm version 0.2.0` creates the bump commit and its tag. `git push --follow-tags` sends both and triggers publication.

### Build and publication

The **build** job checks the version, confirms the source commit is on `main`, and runs the regular verification and Obsidian end-to-end suites. It uses a read-only repository token and uploads the staged release as one artifact. Mutation testing has its own workflow.

The **release** job runs on publication requests. It downloads the verified artifact, attests `main.js`, `manifest.json`, and `styles.css`, and publishes those three assets. A manual publication checks again that the tag is available and targets the dispatch commit. A tag-started run requires the existing tag. GitHub suppresses a second tag-push workflow when the release job's token creates the tag. [GitHub token event behavior](https://docs.github.com/en/actions/concepts/security/github_token)

The first live release also verifies the hosted runner’s credentials, artifact flow, and attestations. Follow that run from the Actions page. [Workflow and repository setup](github-setup.md)

## Recover a failed run

- **Hand-started run.** Fix failures on `main`. If validation, build, or attestation failed, start the workflow again with the same version. If the publication step was interrupted, inspect Releases and tags first. The GitHub CLI uploads assets to a draft and publishes it through separate API requests. Confirm whether the release published or clean up an incomplete draft with the owner before retrying. Retry the manual route with the same version only when the tag is available. [GitHub CLI release behavior](https://cli.github.com/manual/gh_release_create)
- **Tag-started run.** Fix the failure on `main`. If the tag has no release, remove that tag locally and on GitHub with the owner’s authorization. Tag the corrected commit and push the tag again.

## Stage or install locally

Build and stage the current version locally.

```sh
npm run build && npm run release:package
```

The package is staged in `release/product-engineering/` as `main.js`, `manifest.json`, and `styles.css`. To install by hand, copy those files from a published release or the local package into `<vault>/.obsidian/plugins/product-engineering/`. Enable **Product Engineering** under **Community plugins** in Obsidian.

The production build embeds the third-party notices in `main.js`, so they travel with the asset Obsidian installs. Local staging also provides the readable `THIRD-PARTY-NOTICES.txt` beside the plugin folder. [Third-party notices](../../THIRD-PARTY-NOTICES.txt)

Verify a downloaded asset by passing its local filename to `gh attestation verify`. This command checks `main.js` from the Product Engineering repository.

```sh
gh attestation verify main.js --repo Luis85/product-engineering
```

## Test pre-releases with BRAT

Use a tagged `0.x` release or set `prerelease=true` on manual dispatch for a BRAT beta. BRAT installs the three plugin assets using the bare semantic version tag.

In Obsidian, install and enable BRAT, choose **Add beta plugin**, and enter the Product Engineering repository URL, `https://github.com/Luis85/product-engineering`. Select the version to test. [BRAT guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)

## Submit to the Obsidian Community Plugins directory

1. Merge the implementation and any version bump into `main`. The directory reads the root manifest from the default branch. Review the root README, MIT license, manifest and release version. [Obsidian submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
2. Confirm the regular GitHub release uses the exact manifest version as its bare tag and includes `main.js`, `manifest.json`, and `styles.css` as individual assets. [Obsidian release instructions](https://docs.obsidian.md/plugins/releasing/submit-plugin)
3. The owner signs in to the Community directory, connects the GitHub account that owns the repo, and selects **Plugins → New plugin**. Enter `https://github.com/Luis85/product-engineering`, select the listing owner, and review the policy and maintenance agreement before submitting. [Obsidian directory setup](https://docs.obsidian.md/community-directory/set-up-and-claim#add-a-plugin-or-theme)
4. Check the listing's automated review. Correct errors in the repository and publish a higher version when a new build is required. Use **Review branch** to preview the review of an existing listing before a release. [Obsidian review and release management](https://docs.obsidian.md/community-directory/manage-entry)

The local `npm run lint:scanner` command gives an advisory preview. The directory reports the official submission result. [Obsidian Community directory FAQ](https://docs.obsidian.md/community-directory/faq)

For an installation failure during source review, compare the reviewer's Node and npm versions with a clean `npm ci` and `npm run build` from the release source. Tailwind's `@source` and `@theme` directives are build inputs. Review the shipped `styles.css` for the generated CSS alongside any source warnings.
