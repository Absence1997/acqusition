# syntax=docker/dockerfile:1

# =========================================================================
# One Dockerfile, two environments. Dev vs prod behavior is controlled
# entirely by environment variables / which compose file you run —
# NOT by baking different code paths into the image.
# =========================================================================

# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app
# dumb-init gives the app proper PID 1 signal handling (clean SIGTERM on
# `docker compose down`, no zombie processes).
RUN apk add --no-cache dumb-init

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json package-lock.json* ./
# Install full deps (includes devDependencies, harmless here since we have none
# beyond runtime deps; keeps this stage reusable if you add a build step later)
RUN npm install --omit=dev

# ---------- Production runtime image ----------
FROM base AS production
ENV NODE_ENV=production

# Run as a non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs package.json ./
COPY --chown=nodeuser:nodejs src ./src

# Pre-create writable runtime dirs (e.g. winston log output) owned by the
# non-root user, so the app doesn't fail trying to mkdir them itself.
RUN mkdir -p logs && chown -R nodeuser:nodejs logs

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]