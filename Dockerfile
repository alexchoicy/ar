FROM node:24-alpine AS admin-build

WORKDIR /app

RUN corepack enable

COPY ar-admin/package.json ar-admin/pnpm-lock.yaml ar-admin/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY ar-admin/index.html ar-admin/tsconfig*.json ar-admin/vite.config.ts ar-admin/env.d.ts ar-admin/components.json ./
COPY ar-admin/public ./public
COPY ar-admin/src ./src
RUN pnpm build

FROM node:24-alpine AS backend-build

WORKDIR /app

RUN corepack enable

COPY ar-backend/package.json ar-backend/pnpm-lock.yaml ar-backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY ar-backend/tsconfig.json ./
COPY ar-backend/src ./src
RUN pnpm build
RUN pnpm prune --prod

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/package.json ./package.json
COPY --from=backend-build /app/dist ./dist
COPY ar-backend/public ./public
COPY --from=admin-build /app/dist ./public/admin

EXPOSE 3000

CMD ["node", "dist/server.js"]
