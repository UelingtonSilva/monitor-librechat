## What this changes and why

<!-- The "why" matters more than the "what" — link an issue if there is one. -->

## How it was tested

<!-- `npm run build`, `npm test`, and lint all need to pass locally (CI checks this too),
     but that only proves the code compiles and the existing tests still pass — it does not
     prove the feature works. If you touched a UI page, say how you actually exercised it
     (which screen, which language, with or without a real MongoDB connection). -->

## Checklist

- [ ] `npm run build`, `npm test`, and `npm run lint` pass locally
- [ ] New or changed strings were added to **both** `locales/en/*.json` and
      `locales/pt-BR/*.json` (the key-parity test in `apps/monitor-portal` fails otherwise)
- [ ] No secrets, real connection strings, or real user/organization data in the diff
- [ ] Comments explain _why_, not _what_ — see `CONTRIBUTING.md`
