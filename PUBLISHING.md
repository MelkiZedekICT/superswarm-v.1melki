# Publishing Superswarm

Superswarm publishes from `.github/workflows/publish.yml` only when a version
tag is pushed. Ordinary commits to `main` run CI and never attempt an npm
release.

## npm authentication

Use one of these repository configurations:

1. Add a GitHub Actions secret named `NPM_TOKEN` containing a granular npm
   token with read/write access to `@melkizedekict/superswarm`.
2. Configure npm trusted publishing for GitHub repository
   `MelkiZedekICT/superswarm-v.1melki` and workflow `publish.yml`. The workflow
   already grants `id-token: write` and uses Node 24.

The token path runs `npm whoami` before publishing. A missing token falls back
to trusted publishing. Authentication values are never written into the
repository or printed by the workflow.

## Release procedure

Update `package.json`, `src/index.ts`, and `CHANGELOG.md` to the same version,
then run:

```sh
bun install --frozen-lockfile
bun run build:ui
bun run lint
bun run typecheck
bun test
node --test scripts/release-check.test.mjs scripts/npm-version-status.test.mjs
node scripts/release-check.mjs --tag vVERSION
npm pack --dry-run
git tag -a vVERSION -m "Superswarm VERSION"
git push origin main --follow-tags
```

The workflow checks the exact Superswarm version in the npm registry. Existing
versions are not republished, registry outages stop the release, prereleases use
the `next` distribution tag, and the GitHub release step is idempotent.

## Failure recovery

Open the failed job and identify its first failing step:

- `Configure npm authentication`: replace or grant package access to
  `NPM_TOKEN`, or configure the trusted publisher.
- `Publish package`: confirm the `@melkizedekict` scope and package write access.
- `Validate source and package`: fix the reported version, changelog, build, or
  test mismatch and publish a new version tag. npm versions cannot be replaced.

After fixing repository authentication, rerun the failed tag workflow. Do not
create a second tag for the same package version unless source code changes.
