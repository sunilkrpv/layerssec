# Stage 1: Install dependencies
FROM node:20-slim AS deps
# python3 make g++ are required to compile native modules (e.g. bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Stage 3: Production runner
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nestjs

# Copy compiled output, prisma schema/client, and production deps
COPY --from=builder --chown=nestjs:nodejs /app/dist            ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules    ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma          ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json    ./package.json

USER nestjs

EXPOSE 4000

# Run migrations then start (entrypoint handles migration on deploy)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
