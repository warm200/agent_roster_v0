FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .
RUN mkdir -p /app/openclaw_config_test
RUN pnpm build

FROM base AS app

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/proxy.ts ./proxy.ts
COPY --from=builder /app/components.json ./components.json
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/hooks ./hooks
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server ./server
COPY --from=builder /app/services ./services
COPY --from=builder /app/styles ./styles
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/docker ./docker
COPY --from=builder /app/agents_file ./agents_file
COPY --from=builder /app/openclaw_config_test ./openclaw_config_test
RUN chmod +x /app/docker/entrypoints/*.sh

EXPOSE 3000

CMD ["pnpm", "start"]

FROM nginx:1.27-alpine AS nginx

COPY docker/nginx/default.http.conf /etc/nginx/openroster/default.http.conf
COPY docker/nginx/default.https.conf /etc/nginx/openroster/default.https.conf
COPY docker/nginx/configure.sh /docker-entrypoint.d/40-configure-openroster.sh
RUN chmod +x /docker-entrypoint.d/40-configure-openroster.sh
