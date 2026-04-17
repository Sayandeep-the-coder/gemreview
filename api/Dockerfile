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

# Only copy production dependencies and built output
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Ensure the port aligns with Cloud Run's default (8080)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
