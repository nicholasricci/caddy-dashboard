# Docker configuration (`docker/dev`)

This directory contains the Docker build and nginx configuration for containerized deployment of the Caddy Dashboard (static app + reverse proxy to the API). The layout lives under `docker/dev` for a clear, repo-local path; the resulting image is suitable for any environment where you attach it to a backend reachable as `caddy-dashboard-api`.

## Architecture

```
Internet -> nginx (port 80) -> Backend (internal port 8000)
         -> Static Files (Angular app)
```

## Key Features

- **Nginx Reverse Proxy**: All API calls to `/api/*` are proxied to the backend
- **Backend Isolation**: Backend is not exposed to the public internet
- **Static File Serving**: Angular app served directly by nginx with optimal caching
- **CORS Handling**: Nginx handles CORS preflight requests
- **Security Headers**: Security headers added by nginx
- **Health Check**: Health endpoint available at `/health`

## Configuration Details

### nginx.conf
- **Upstream Backend**: Configured to proxy to `caddy-dashboard-api:8000`
- **API Proxy**: All `/api/*` requests are forwarded to the backend
- **Static Assets**: Optimized caching for JS/CSS/images (1 year cache)
- **Angular Routing**: SPA routing support with fallback to `index.html`
- **Security**: Various security headers added

### Environment Files
- **Production** (`environment.ts`): Uses `/api` for API calls (proxied by nginx)
- **Development** (`environment.development.ts`): Direct connection to `localhost:8000`

## Usage

### CI: immagine su GitHub Container Registry

La workflow [`.github/workflows/publish-dockerfile.yaml`](../../.github/workflows/publish-dockerfile.yaml) parte quando pubblichi una **GitHub Release** (`release` → `published`). Fa checkout del **tag** della release, builda e pusha l’immagine con tag uguale al nome del tag della release e, se la release non è una prerelease, anche `latest`.

### Using Docker Build + Docker Run

1. **Build the frontend image**:
   ```bash
   docker build -f docker/dev/Dockerfile -t caddy-dashboard:dev .
   ```

2. **Run with a backend container named `caddy-dashboard-api`**:
   ```bash
   # Create a network
   docker network create caddy-dashboard-network
   
   # Run backend (replace with your backend image)
   docker run -d --name caddy-dashboard-api --network caddy-dashboard-network your-backend-image:latest
   
   # Run frontend
   docker run -d --name frontend -p 8080:80 --network caddy-dashboard-network caddy-dashboard:dev
   ```

## Security Considerations

- Backend is only accessible through nginx proxy
- No direct backend exposure to internet
- Security headers added by nginx
- CORS handled at proxy level
- Static assets have proper cache headers

## Customization

### Backend URL
The default upstream is `caddy-dashboard-api:8000`. If your backend uses a different name or port, update the upstream configuration in `nginx.conf`:

```nginx
upstream backend {
    server your-backend-service:your-port;
}
```

### API Path
If you need a different API path prefix, update both:
1. `nginx.conf` location block
2. Environment files (`apiUrl` property)

### Additional Headers
Add custom headers in the `location /api/` block in `nginx.conf`.

## Monitoring

- Health check available at: `http://localhost:8080/health`
- nginx logs available in container: `/var/log/nginx/`
- Access logs: `/var/log/nginx/access.log`
- Error logs: `/var/log/nginx/error.log`
