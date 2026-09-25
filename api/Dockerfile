# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies and build tools
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY . .

# Build the TypeScript code
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

# Only copy production dependencies and built output
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Ensure the port aligns with the API's default (3001)
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
