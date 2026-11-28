# Contributing to harness-lingo-translator

Thanks for helping. This repository is a derivative of
[PerryLink/dsh-translate](https://github.com/PerryLink/dsh-translate), maintained
at [sakemo12/harness-lingo-translator](https://github.com/sakemo12/harness-lingo-translator).

## Before you open an issue

- Read the README and `PRIVACY.md`.
- Include the package version, DSH host version, OS/Node version, the exact action, and a minimal redacted sample (never real personal data).
- For a mistranslation, include the **original text node**, the **translated output**, the target language, and whether the page used a protected span (code, path, command, identifier).

## Pull requests

- Keep the display-only contract: no session append, no workspace write, and no
  config write outside the user's explicit Save on the Plugins page. The only
  host file write is the per-workspace cache under
  `~/.dsh/cache/harness-lingo-translator/`; the workspace itself is never written.
- Keep placeholder verification fail-closed: a translation that loses, renumbers or invents a placeholder token must keep the original text.
- Add or update a test under `test/`; `pnpm test` must pass on Node 22 and 24.
- Run `pnpm run lint` and `pnpm run verify:self-contained` before opening the PR.
- Do not add a build step to the client bundle without updating `client/index.js`'s loader shape and the descriptor parity test.
- Keep both READMEs (Chinese and English) in sync for user-visible behaviour.
- Keep the copyright header in `LICENSE`/`NOTICE` intact; new third-party
  material needs an entry in `THIRD_PARTY_NOTICES.md`.

## Security

Report vulnerabilities through a private security advisory, not a public issue. See `SECURITY.md`.
