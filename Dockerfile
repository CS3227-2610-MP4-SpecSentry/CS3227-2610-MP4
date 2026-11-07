FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY src/shared/package.json src/shared/package.json
COPY src/server/package.json src/server/package.json
COPY src/client/package.json src/client/package.json
RUN npm ci --ignore-scripts --no-fund --no-audit
COPY src ./src
RUN npm run db:generate && npm run build && npm prune --omit=dev --ignore-scripts
RUN mkdir -p src/server/node_modules src/shared/node_modules

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS runtime
ARG VCS_REF=local
ENV NODE_ENV=production
ENV PORT=3000
ENV DEPLOYMENT_SOURCE_SHA=${VCS_REF}
LABEL org.opencontainers.image.source="https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4"
LABEL org.opencontainers.image.revision=${VCS_REF}
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade apt libapt-pkg6.0 \
    && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/src/server/package.json ./src/server/package.json
COPY --from=build --chown=node:node /app/src/server/dist ./src/server/dist
COPY --from=build --chown=node:node /app/src/server/node_modules ./src/server/node_modules
COPY --from=build --chown=node:node /app/src/shared/package.json ./src/shared/package.json
COPY --from=build --chown=node:node /app/src/shared/dist ./src/shared/dist
COPY --from=build --chown=node:node /app/src/shared/node_modules ./src/shared/node_modules
COPY --from=build --chown=node:node /app/src/client/dist ./src/client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server/dist/main.js"]
