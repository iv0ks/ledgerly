# Single source of truth for the Node version used by all stages.
# Node 24 is the current LTS ("Krypton").
ARG NODE_VERSION=24

######################################################################################################
#############################                  STAGE 1: BUILD                   ######################
######################################################################################################

FROM node:${NODE_VERSION}-slim AS builder

# Apply available OS security patches before building.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Enable the pinned pnpm via corepack (declared in package.json "packageManager").
RUN corepack enable

WORKDIR /build

# Install dependencies first (better layer caching). Copy only manifests.
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy the sources and build.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY drizzle ./drizzle

# Compile TypeScript to dist/, then copy the static UI assets that tsc does not
# emit (.html/.css/.js/.svg) into dist/public so the runtime can serve them.
RUN pnpm build \
    && cp -r src/public dist/public

# Produce a production-only dependency tree for the runtime stage.
RUN pnpm prune --prod

######################################################################################################
#############################                  STAGE 2: RUNTIME                 ######################
######################################################################################################

FROM node:${NODE_VERSION}-slim AS runtime

# Apply OS security patches on top of the base image.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Non-root user to run the app.
RUN useradd --create-home --uid 10001 appuser

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Bring in production deps, compiled app, and the migrations folder.
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/drizzle ./drizzle
COPY --from=builder /build/package.json ./package.json

# Copy the entrypoint that migrates + seeds before starting the server.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Bake the challenge flag into the image at build time. The seed script reads
# it from the environment and writes it into the victim's invoice note. The
# flag is intentionally NOT committed to the repo (it would spoil the lab).
# Override with --build-arg FLAG=...
ARG FLAG=FLAG{LEDGERLY_BALANCE_EXPOSED}
ENV FLAG=${FLAG}

USER appuser

EXPOSE 3000

# Health check hits the app's /healthz endpoint (returns the literal "ok").
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>r.text()).then(t=>process.exit(t==='ok'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
