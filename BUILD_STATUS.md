# Superswarm build status

Verified on 19 September 2026, Windows, Bun 1.4.2.

## Completed

- Installed locked backend and UI dependencies.
- Built the original React console successfully (`bun run build` in `ui`).
- Backend TypeScript check passed (`bun run typecheck`).
- Biome passed: 347 files checked (`bun run lint`).
- CLI help runs and displays Superswarm.
- Fixed worktree root discovery with native Windows path separators. The existing
  regression case passed on the subsequent upstream test run.
- Fixed package asset resolution with `fileURLToPath` and version loading with a
  file URL, preserving Windows drive letters and decoding escaped path characters.
- Server tests verified health responses, route registration, static files, SPA
  fallback, and serving the package-built console from a different project.

## Design fidelity

Compared `ui/` against imported upstream commit
`ff38f3f76f084abcc34f519bcaa69580f6e53cf1`. Only three files differ:
`ui/index.html`, `ui/src/components/Logo.tsx`, and `ui/src/lib/brand.ts`.
All changes are Superswarm branding. Layout, styles, navigation, and controls
remain upstream's implementation. This source comparison is not a completed
interactive visual review.

## Test limitations

`bun test --bail` ran 281 tests across 11 files before stopping at Windows
`EBUSY` during temporary-directory cleanup in `headless-mail-injector.test.ts`.
The failing case leaves a database file locked. The full suite has not passed.

The focused `serve.test.ts` run passed its first 16 cases, including packaged
asset serving, then stopped at another `EBUSY` cleanup error in the dev-server
wiring tests. Test cleanup ownership and native Ubuntu verification remain work.
Do not interpret these partial runs as an all-tests-pass result.

## Reproduce

```sh
bun install --frozen-lockfile
cd ui
bun install --frozen-lockfile
bun run build
cd ..
bun run typecheck
bun run lint
bun test --bail
bun src/index.ts --help
```

The repository now enforces LF text checkout on Windows and Linux so the
formatter sees the same line endings on both systems.

## Next build work

1. Resolve database cleanup failures and verify the baseline on native Ubuntu.
2. Initialize a disposable target repository and inspect the live console,
   messaging, worktrees, and review workflow without cloud model calls.
3. Integrate two or three measured local model profiles, sequential by default
   on limited hardware, with every inference route local and no remote fallback.
4. Demonstrate real agent edits, tests, review, and cancellation before releasing.

No local models are installed or connected. Upstream cloud defaults remain;
this checkpoint must not be presented as the completed local-only application.
See [PROJECT.md](PROJECT.md) for requirements, research sources, and learning priorities.
