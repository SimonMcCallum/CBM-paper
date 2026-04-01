# Multi-stage build for CBM LTI Plugin

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src ./src
COPY migrations ./migrations
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy built app and assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY public ./public

# Create directories
RUN mkdir -p /app/data /app/uploads/qti /app/uploads/submissions

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
