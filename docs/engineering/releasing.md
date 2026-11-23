# Releasing Product Engineering

Publish only when the repository owner asks for a release. Use a bare `x.y.z` version such as `0.2.0`. Raise `minAppVersion` before the bump if the plugin now requires a newer Obsidian API.

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

## Start the release

In GitHub, open **Actions → Release → Run workflow**, choose `main`, and supply `0.2.0` for `version`. GitHub CLI accepts the same inputs.

```sh
gh workflow run release.yml --ref main -f version=0.2.0
```

You can also start the workflow by pushing a bare tag after updating `origin/main`.

```sh
git fetch origin main
git tag 0.2.0 origin/main
git push origin 0.2.0
```

Where direct updates to `main` are allowed, `npm version 0.2.0` creates the bump commit and its tag. `git push --follow-tags` sends both and triggers publication.

### Build and publication

The **build** job checks the version, confirms the source commit is on `main`, and runs the verification and Obsidian end-to-end suites. It uses a read-only repository token and uploads the staged release as one artifact.

The **release** job downloads that artifact and attests the same four files it publishes. It uses the runner’s GitHub CLI and pinned actions. A hand-started run checks that the tag is available again immediately before requesting publication and targets the event commit. A tag-started run requires the existing tag. GitHub suppresses a second tag-push workflow when the release job's token creates the tag. [GitHub token event behavior](https://docs.github.com/en/actions/concepts/security/github_token)

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

`THIRD-PARTY-NOTICES.txt` is the fourth published asset. The local staging script leaves it beside the plugin folder. It records licenses for the packages in the bundle. [Third-party notices](../../THIRD-PARTY-NOTICES.txt)

Verify a downloaded asset by passing its local filename to `gh attestation verify`. This command checks `main.js` from the Product Engineering repository.

```sh
gh attestation verify main.js --repo Luis85/product-engineering
```

## Test pre-releases with BRAT

The workflow publishes `0.x` versions as pre-releases. Releases from `1.0.0` onward are regular releases. BRAT installs the three plugin assets using the bare semantic version tag.

In Obsidian, install and enable BRAT, choose **Add beta plugin**, and enter the Product Engineering repository URL, `https://github.com/Luis85/product-engineering`. Select the version to test. [BRAT guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)
