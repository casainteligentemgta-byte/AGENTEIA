# SmartImport — multi-stage production image
# Build: docker build -t smartimport:latest -f Dockerfile .
# Run:   docker run -p 3000:3000 --env-file .env smartimport:latest

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY healthcheck.js ./

RUN mkdir -p /app/logs && chown -R app:app /app/logs

USER app

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
