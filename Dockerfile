# Stage 1: Install dependencies
FROM node:20-alpine AS deps
# python3 make g++ are required to compile native modules (e.g. bcrypt)
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# Copy compiled output, prisma schema/client, and production deps
COPY --from=builder --chown=nestjs:nodejs /app/dist            ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules    ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma          ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json    ./package.json

USER nestjs

EXPOSE 4000

# Run migrations then start (entrypoint handles migration on deploy)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
