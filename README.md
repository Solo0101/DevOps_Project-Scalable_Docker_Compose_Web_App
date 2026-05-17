# Multi-Tier Application - Dockerised & Orchestrated

> **Practical P11** - Containerise and orchestrate an app  
> **Topic**: Containers and serverless  
> **Stack**: Angular 21 (Frontend) + .NET 10 (Backend) + PostgreSQL (Database)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Project Structure](#project-structure)
5. [Docker Deep Dive](#docker-deep-dive)
   - [Multi-Stage Builds](#multi-stage-builds)
   - [Health Checks](#health-checks)
   - [Networking](#networking)
   - [Volumes](#volumes)
6. [Docker Compose](#docker-compose)
   - [Service Definitions](#service-definitions)
   - [Dependencies & Health Conditions](#dependencies--health-conditions)
   - [Scaling](#scaling)
   - [Rolling Updates](#rolling-updates)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices Applied](#best-practices-applied)

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                    Docker Bridge Network                                │
│                                                                       │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐        │
│  │   Frontend   │───▶│   Load Balancer  │───▶│    Backend   │───▶│
│  │  (Nginx +    │    │   (Nginx LB)     │    │  (.NET 10    │    │
│  │   Angular 21)│    │   Round-Robin    │    │   API)       │    │
│  │  :80         │    │   :8080          │    │  :5000 x N   │    │
│  └──────────────┘    └──────────────────┘    └──────────────┘    │
│       ▲                     ▲                     ▲                 │
│       │                     │                     │                 │
│  ┌────┴─────────────────────┴─────────────────────┴────┐           │
│  │     Host: localhost:80 (frontend)                    │           │
│  │     Host: localhost:8080 (proxy/LB)                  │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                       │
│  ┌──────────────┐                                                    │
│  │   Postgres   │                                                    │
│  │   (17)       │                                                    │
│  │   :5432      │                                                    │
│  └──────────────┘                                                    │
└───────────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User accesses `http://localhost:80` in browser
2. Nginx serves Angular static files (SPA)
3. Angular app makes API calls to `/api/*`
4. Frontend Nginx proxies `/api/*` requests to the **load balancer** (proxy service)
5. Load balancer distributes requests across **all backend replicas** (round-robin)
6. Backend queries PostgreSQL for data
7. Response flows back: PostgreSQL → Backend → Load Balancer → Frontend Nginx → Browser

**Load Balancing:**
- The proxy service uses **nginx round-robin** load balancing by default
- When backend is scaled with `--scale backend=N`, the proxy automatically distributes traffic across all N replicas
- `proxy_next_upstream` ensures automatic failover if a backend replica becomes unhealthy
- No manual configuration needed - Docker DNS resolves `backend` to all running containers

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Git | 2.40+ | Version control |

```bash
# Verify installation
docker --version
docker compose version
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd Project

# 2. Build and start all services
docker compose up --build -d

# 3. Check service status
docker compose ps

# 4. View logs
docker compose logs -f

# 5. Access the application
# Frontend: http://localhost:80
# Backend API (via LB): http://localhost:8080/api/items
# Backend Health: http://localhost:8080/healthz
# Backend API (direct): http://localhost:5000/api/items
# Swagger UI: http://localhost:5000/swagger
```

**Stop and clean up:**
```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database!)
docker compose down -v
```

---

## Project Structure

```
Project/
├── docker-compose.yml              # Main orchestration file
├── docker-compose.override.yml     # Scaling & override config
├── .gitignore
├── LICENSE
├── README.md
│
├── backend/                        # .NET 10 Web API
│   ├── Backend.csproj
│   ├── Program.cs                  # App entry point, DI, middleware
│   ├── appsettings.json            # Configuration
│   ├── Dockerfile                  # Multi-stage build
│   ├── Models/
│   │   └── Item.cs                 # Entity model
│   ├── Data/
│   │   └── AppDbContext.cs         # EF Core DbContext + seed data
│   └── Controllers/
│       └── ItemsController.cs      # RESTful CRUD API
│
├── frontend/                       # Angular 21 + Nginx
│   ├── package.json
│   ├── angular.json
│   ├── tsconfig.json
│   ├── Dockerfile                  # Build + serve via Nginx
│   ├── nginx.conf                  # Nginx reverse proxy config
│   └── src/
│       ├── main.ts                 # Bootstrap
│       ├── index.html
│       ├── styles.css
│       └── app/
│           ├── app.component.ts    # Main component (CRUD UI)
│           ├── app.component.html
│           └── app.component.css
│
├── proxy/                          # Nginx Reverse Proxy / Load Balancer
│   ├── Dockerfile                  # Lightweight nginx:alpine
│   └── nginx.conf                  # Upstream backend pool + round-robin LB
```

---

## Docker Deep Dive

### Multi-Stage Builds

Both the frontend and backend use **multi-stage builds** to produce minimal production images.

#### Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Backend.csproj ./
RUN dotnet restore          # Restore dependencies (cached layer)
COPY . .
RUN dotnet publish -c Release -o /app/publish  # Publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "Backend.dll"]
```

**Why multi-stage?**
- Build image (~2GB) contains SDK, source, intermediate files
- Runtime image (~300MB) contains only the published DLL + runtime
- Smaller image = faster pulls, less disk, smaller attack surface

#### Frontend Dockerfile (`frontend/Dockerfile`)

```dockerfile
# Stage 1: Build Angular app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install                  # Install dependencies
COPY . .
RUN npm run build -- --configuration production  # Build with @angular/build:application

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Why two stages?**
- Node build image needed for `npm run build`
- Nginx image serves the compiled static files
- Final image is just Nginx + compiled Angular files (~40MB)

### Health Checks

Every service has a **Docker HEALTHCHECK** for automatic monitoring:

```yaml
# PostgreSQL - uses pg_isready
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d appdb"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s

# Backend - HTTP endpoint
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:5000/healthz || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 20s

# Frontend (Nginx) - uses wget (Alpine)
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost/nginx-health || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 10s
```

**Health check parameters:**
| Parameter | Purpose |
|-----------|---------|
| `interval` | Time between health checks |
| `timeout` | Max time for a check to complete |
| `retries` | Consecutive failures before marking unhealthy |
| `start_period` | Grace period for service startup |

**Check health manually:**
```bash
docker inspect --format='{{.State.Health.Status}}' app-backend
# Output: healthy | unhealthy | starting
```

### Networking

All services connect via a **custom bridge network** (`app-network`):

```yaml
networks:
  app-network:
    driver: bridge
```

**DNS-based service discovery:**
- Backend connects to database using hostname `postgres`
- Frontend Nginx proxies `/api/*` to the load balancer using hostname `proxy`
- Load balancer uses Docker DNS to resolve `backend` to all running backend containers
- No hardcoded IPs needed

**Port mapping (host → container):**
| Service | Host Port | Container Port | Purpose |
|---------|-----------|---------------|---------|
| Frontend | 80 | 80 | Web UI |
| Proxy (LB) | 8080 | 8080 | API Load Balancer |
| Backend | 5000 | 5000 | REST API |
| Postgres | 5432 | 5432 | Database |

### Load Balancing

The proxy service implements **nginx round-robin load balancing** across backend replicas:

```nginx
upstream backend_pool {
    server backend:5000;  # Docker DNS resolves to all backend containers
}
```

**Key features:**
- **Round-robin**: Requests distributed evenly across all healthy backend replicas
- **Automatic failover**: `proxy_next_upstream` retries on error/timeout/5xx
- **No config changes needed**: Scaling with `--scale` automatically updates the pool
- **Health-aware**: Proxy only sends traffic to healthy backends

**Verify load balancing:**
```bash
# Scale backend to 3 replicas
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --scale backend=3

# Send 6 requests - should be distributed across 3 backends (2 each)
for i in {1..6}; do curl -s http://localhost:5000/api/items | jq '.[0].name'; done
```

### Volumes

**Persistent database storage:**
```yaml
volumes:
  postgres-data:
    driver: local
```

- Data survives `docker compose down`
- Mapped to `/var/lib/postgresql/data` inside the container
- Seed data (3 sample items) applied on first run via EF Core migrations

---

## Docker Compose

### Service Definitions

The `docker-compose.yml` defines four services:

| Service | Image/Build | Ports | Restart |
|---------|-------------|-------|---------|
| `frontend` | Built from `./frontend/Dockerfile` | 80:80 | unless-stopped |
| `proxy` | Built from `./proxy/Dockerfile` | 8080:8080 | unless-stopped |
| `backend` | Built from `./backend/Dockerfile` | 5000:5000 | unless-stopped |
| `postgres` | `postgres:17-alpine` | 5432:5432 | unless-stopped |

### Dependencies & Health Conditions

Services start in the correct order using `depends_on` with **health conditions**:

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy    # Wait for DB to be ready

proxy:
  depends_on:
    backend:
      condition: service_healthy    # Wait for backend to be ready

frontend:
  depends_on:
    proxy:
      condition: service_healthy    # Wait for LB to be ready
```

This ensures:
1. PostgreSQL starts and passes health checks first
2. Backend starts only when PostgreSQL is healthy
3. Proxy (load balancer) starts only when backend is healthy
4. Frontend starts after the load balancer is ready

### Scaling

Scale the backend to handle more requests. The **proxy (load balancer) automatically distributes traffic** across all replicas using round-robin:

```bash
# Start with 1 backend replica
docker compose up -d

# Scale backend to 3 replicas
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --scale backend=3

# Verify
docker compose ps
# Shows: app-backend (1/3), app-backend-1 (2/3), app-backend-2 (3/3)

# Verify load balancing - requests distributed across replicas
for i in {1..6}; do curl -s http://localhost:8080/api/items | jq '.[0].name'; done

# Scale down to 1 replica
docker compose up -d --scale backend=1

# Scale frontend (for static content distribution)
docker compose up -d --scale frontend=2
```

**How it works:**
1. `--scale backend=3` creates 3 containers: `app-backend`, `app-backend-1`, `app-backend-2`
2. Docker DNS resolves the `backend` hostname to all 3 container IPs
3. The proxy's nginx `upstream backend_pool` block uses DNS to discover all backends
4. Nginx round-robin distributes requests evenly: request 1→backend-1, request 2→backend-2, request 3→backend-3, request 4→backend-1, etc.
5. `proxy_next_upstream` automatically retries on a different backend if one fails

### Rolling Updates

Update services without downtime:

```bash
# 1. Pull latest images
docker compose pull

# 2. Rolling update backend (one at a time)
docker compose up -d --no-deps --force-recreate backend

# 3. Rolling update proxy (load balancer)
docker compose up -d --no-deps --force-recreate proxy

# 4. Rolling update frontend
docker compose up -d --no-deps --force-recreate frontend

# 5. Rolling update all services
docker compose up -d --force-recreate
```

**Full rebuild and update cycle:**
```bash
# Rebuild all images and restart in correct order
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify all services healthy
docker compose ps
```

**Update a single service with dependency chain:**
```bash
# Update backend (will restart proxy + frontend since they depend on it)
docker compose up -d --no-deps --force-recreate backend proxy frontend
```

---

## Development Workflow

### Start in development mode

```bash
# Build and start with auto-reload for backend
docker compose up --build -d

# Watch backend changes (requires docker-compose.dev.yml)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f postgres

# Last 50 lines
docker compose logs --tail=50 backend
```

### Execute commands in containers

```bash
# Open shell in backend container
docker compose exec backend sh

# Open shell in PostgreSQL
docker compose exec postgres psql -U postgres -d appdb

# Run EF Core migration manually
docker compose exec backend dotnet ef database update
```

### Reset everything

```bash
# Stop, remove containers, networks, and volumes
docker compose down -v

# Remove all unused images
docker image prune -a
```

---

## Troubleshooting

### Backend won't start

```bash
# Check if PostgreSQL is healthy
docker compose ps

# Check backend logs
docker compose logs backend

# Common fix: database not ready
docker compose down -v
docker compose up -d
```

### Frontend shows blank page

- Ensure backend is running: `curl http://localhost:8080/api/items`
- Check browser console for CORS errors
- Verify Nginx is serving files: `curl http://localhost/`

### API returns 502 Bad Gateway

- Check proxy is healthy: `docker inspect --format='{{.State.Health.Status}}' app-proxy`
- Check backend containers: `docker compose ps | grep backend`
- Verify proxy can reach backend: `docker compose exec proxy wget -qO- http://backend:5000/healthz`

### Database connection refused

- Verify PostgreSQL is healthy: `docker inspect --format='{{.State.Health.Status}}' app-postgres`
- Check connection string in `backend/appsettings.json`
- Ensure `DB_HOST=postgres` (use service name, not `localhost`)

### Port conflicts

```bash
# Check what's using port 80
netstat -ano | findstr :80

# Use different ports in docker-compose.yml
# ports:
#   - "8080:80"   # Host:Container
```

### Rebuild specific service

```bash
docker compose build backend
docker compose up -d backend
```

---

## Best Practices Applied

| Practice | Implementation |
|----------|---------------|
| **Multi-stage builds** | Backend: SDK → ASP.NET Runtime; Frontend: Node → Nginx |
| **Alpine-based images** | `postgres:17-alpine`, `nginx:alpine`, `node:20-alpine` |
| **Health checks** | All 4 services have `healthcheck` |
| **Dependency ordering** | `depends_on` with `condition: service_healthy` |
| **Named volumes** | `postgres-data` for persistent database storage |
| **Custom bridge network** | `app-network` for service discovery via DNS |
| **Load balancing** | Nginx round-robin across backend replicas |
| **Automatic failover** | `proxy_next_upstream` retries on backend failure |
| **Non-root considerations** | Minimal runtime images reduce attack surface |
| **Environment variables** | Configurable via environment, not hardcoded |
| **Restart policies** | `unless-stopped` for automatic recovery |
| **Graceful shutdown** | Nginx `daemon off;` for proper signal handling |
| **Gzip compression** | Nginx configured for static asset compression |
| **CORS configured** | Backend allows frontend origin |
| **Seed data** | 3 sample items seeded via EF Core `HasData()` |
| **API versioning ready** | `/api/items` route structure |
| **Swagger UI** | Available in development at `/swagger` |

---

## API Reference

### GET `/api/items`
Return all items.

```bash
curl http://localhost:8080/api/items
```

### GET `/api/items/{id}`
Return a single item.

```bash
curl http://localhost:8080/api/items/1
```

### POST `/api/items`
Create a new item.

```bash
curl -X POST http://localhost:8080/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Monitor","description":"4K display","price":399.99}'
```

### PUT `/api/items/{id}`
Update an existing item.

```bash
curl -X PUT http://localhost:8080/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{"id":1,"name":"Laptop Pro","description":"Updated","price":1299.99}'
```

### DELETE `/api/items/{id}`
Delete an item.

```bash
curl -X DELETE http://localhost:8080/api/items/1
```

### GET `/healthz`
Backend health check endpoint (via load balancer).

```bash
curl http://localhost:8080/healthz
```

---

**Built with Docker, Angular 21, .NET 10, and PostgreSQL 17.**
