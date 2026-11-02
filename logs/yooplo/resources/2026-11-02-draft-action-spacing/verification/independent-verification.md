# Independent draft action layout verification

- Scope: actual Vite frontend at 127.0.0.1:5173, Chromium/Chrome, isolated contexts with every API request routed to synthetic fixtures. No real draft read or database/business mutation occurred.
- Browser command: `node tmp/draft-action-spacing-20261102/check-layout.mjs` exited 0; 1440px, 768px and 375px passed. Safe numeric geometry and appearance evidence: [browser-results.json](browser-results.json).
- Desktop/tablet: Submit and Withdraw share a row with exactly 16px horizontal separation; Delete sits on a separate row 24px below. All action heights 44px.
- Mobile375: all three controls are 333px wide and 44px high; Submit/Withdraw vertical gap16px, Delete separation24px. No viewport horizontal overflow.
- Existing blue primary Submit, white/slate secondary Withdraw and red-text/border destructive Delete were independently checked from computed styles and desktop/mobile screenshots visually inspected.
- Keyboard order Submit -> Withdraw -> Delete passed at each width. Each action opened its existing confirmation; cancellation and expected focus behavior passed. Zero non-GET requests at all widths; zero page errors.
- Existing behavior tests: `npm.cmd run test -w @specsentry/client -- src/features/contributor/ContributorLifecycle.test.tsx src/features/contributor/DeleteDraft.test.tsx`: 2 files /56 tests passed, exit0.
- Client typecheck: `npm.cmd run typecheck -w @specsentry/client` passed, exit0.
- Source diff review: classes/wrappers only and Withdraw existing secondary-button class. All original handlers, conditions, disabled expressions, refs and forms preserved. Shared submitted ProposalActions also receives grouping/secondary styling as intended; no business behavior changes.
- Screenshots: [desktop1440](draft-actions-1440.png), [tablet768](draft-actions-768.png), [mobile375](draft-actions-375.png).
- Limitations: synthetic API browser acceptance establishes layout/client interactions only. No actual submit/withdraw/delete executed against a database, no full-suite rerun, no manual-device or whole-page accessibility certification. Existing targeted behavior suites cover mutation/recovery paths.
