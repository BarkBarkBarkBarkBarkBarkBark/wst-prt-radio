FROM node:20-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build --filter=api
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
