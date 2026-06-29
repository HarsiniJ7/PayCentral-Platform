# --- deps: install once, reused by both build and (optionally) test stages ---
FROM node:24-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 needs a C++ toolchain to build its native binding.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install

# --- build: compile TypeScript -> dist ---
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# --- runtime: slim image, no build toolchain, non-root user ---
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r paycentral && useradd -r -g paycentral paycentral

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Writable volume for the SQLite file - the rest of the image stays read-only-friendly.
RUN mkdir -p /app/data && chown -R paycentral:paycentral /app
ENV DB_PATH=/app/data/paycentral.db

USER paycentral
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
