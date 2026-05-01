FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json


RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @wstprtradio/shared build \
	&& pnpm --filter @wstprtradio/api build

COPY apps/api/src/db/migrations ./apps/api/dist/db/migrations

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
