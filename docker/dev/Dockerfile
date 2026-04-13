# Multi-stage build for Angular 20 application
FROM node:20.19-alpine AS build

# Set working directory
WORKDIR /app

# Ensure devDependencies are installed for Angular build tooling
ENV NODE_ENV=development

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application for production
RUN npm run build

# Production stage
FROM nginx:1.27-alpine

# Copy custom nginx configuration
COPY docker/dev/nginx.conf /etc/nginx/nginx.conf

# Copy built application from build stage
COPY --from=build /app/dist/caddy-dashboard/browser /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
