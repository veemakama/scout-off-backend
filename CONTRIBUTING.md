# Contributing to ScoutOff Backend

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to run checks before each commit.

On `git commit`, staged `.ts` files are checked with:

- **ESLint** — blocks the commit on lint errors
- **TypeScript** (`tsc --noEmit`) — blocks the commit on type errors

Hooks are installed automatically when you run `npm install` (via the `prepare` script).

### Skipping hooks

In rare cases (e.g. work-in-progress commits on a feature branch), you can bypass the pre-commit hook:

```bash
git commit --no-verify -m "wip: describe change"
```

Use `--no-verify` sparingly. CI still runs lint and type checks, and commits that skip local checks can clog the pipeline.

### Manual checks

```bash
npm run lint
npx tsc --noEmit
npm test
```
