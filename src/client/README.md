# Frontend

This workspace owns browser UI only. `index.html` loads `src/main.tsx`, which
mounts React and the router. `src/App.tsx` renders the setup/status page;
`src/styles.css` owns its styling. `vite.config.ts` configures local API proxying,
production builds and Vitest. `src/test/` contains test setup; component tests
live beside the components they exercise.

Use relative `/api` URLs. Production NestJS serves this workspace's `dist/` from
the same hostname as the API. No browser database access or provider keys belong
here. `VITE_*` variables become public build-time values. Role screens follow
when server-side authentication and authorization are implemented.

`src/features/{contributor,reviewer,maintainer}` reserves role-specific UI areas.
`src/shared` reserves reusable presentation and HTTP handling. These directories
do not register routes or grant access; the existing setup page remains unchanged.
