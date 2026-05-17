# =============================================================================
# Nginx Reverse Proxy / Load Balancer - Dockerfile
# Lightweight image for load balancing backend replicas
# =============================================================================

FROM nginx:alpine

# Copy load balancer configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
