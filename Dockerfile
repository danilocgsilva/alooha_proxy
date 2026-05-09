FROM node:22-alpine AS builder

WORKDIR /app

COPY app/package.prod.json ./package.json

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

FROM node:22-alpine

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

CMD ["node", "dist/server.js"]