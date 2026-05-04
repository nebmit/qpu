# syntax=docker/dockerfile:1

FROM cgr.dev/chainguard/node:latest-dev AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .
RUN npm run build

FROM cgr.dev/chainguard/node:latest-dev AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /app/node_modules

FROM cgr.dev/chainguard/node:latest AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=nonroot:nonroot /app/build ./build
COPY --from=build --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules ./node_modules

USER nonroot
EXPOSE 3000

CMD ["node", "build"]
