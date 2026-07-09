# Containerized for VPC-parity deployment (portability §8). Distroless-ish: only the
# runtime and production deps. No PII is ever stored, so no volumes are mounted.
# One image runs everywhere: a plain container host (Render) runs the CMD directly;
# AWS Lambda activates the Lambda Web Adapter extension below to bridge function
# invocations to the same HTTP server. Outside Lambda the adapter file is inert.
FROM node:22-slim AS base
WORKDIR /app

# AWS Lambda Web Adapter (cost-light preview, infra/preview): lets Lambda run this
# standard HTTP server unmodified. Inert on non-Lambda hosts.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.1 /lambda-adapter /opt/extensions/lambda-adapter

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
# Lambda Web Adapter readiness probe → our no-PII health endpoint (ignored off-Lambda).
ENV AWS_LWA_READINESS_CHECK_PATH=/healthz
EXPOSE 8080
USER node

# Healthcheck hits the no-PII health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "--no-warnings", "api/server.ts"]
