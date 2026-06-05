# Containerized for VPC-parity deployment (portability §8). Distroless-ish: only the
# runtime and production deps. No PII is ever stored, so no volumes are mounted.
FROM node:22-slim AS base
WORKDIR /app

# Install production dependencies only.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App sources (TypeScript run directly via Node's type-stripping).
COPY api ./api
COPY src ./src
COPY corpus ./corpus
COPY forms ./forms
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
USER node

# Healthcheck hits the no-PII health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "--no-warnings", "api/server.ts"]
