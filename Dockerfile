FROM nginx:1.28-alpine
LABEL org.opencontainers.image.source="https://github.com/Alumos/beidou-assembly-lab" \
      org.opencontainers.image.title="Beidou Assembly Lab"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
EXPOSE 80
