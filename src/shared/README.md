# Shared browser-safe contracts

This workspace contains Zod HTTP schemas and inferred TypeScript types usable
by both client and server. `src/index.ts` is its public entry point. The build
emits CommonJS, ESM and type declarations into ignored `dist/`.

Keep this package free of database clients, Node-only APIs, credentials, provider
prompts and authorization implementations. Server authorization remains required
even when a browser validates the same input schema.
