FROM node:22-alpine AS build
WORKDIR /app

# Install security updates
RUN apk add --no-cache --upgrade apk-tools alpine-keys && \
    apk update && \
    apk upgrade

ARG VITE_API_BASE_URL=/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./

# Install dependencies with npm ci for reproducible builds
RUN npm ci --audit && npm audit fix

COPY . .

# Build with security checks
RUN npm run build

# Final stage - minimal nginx image
FROM nginx:1.27-alpine

# Install security updates
RUN apk add --no-cache --upgrade apk-tools alpine-keys && \
    apk update && \
    apk upgrade

# Create non-root user
RUN addgroup -g 101 -S nginx || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

# Copy built assets
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health.html || exit 1


CMD ["nginx", "-g", "daemon off;"]
