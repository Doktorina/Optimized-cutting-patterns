# ─── Этап 1: Сборка фронтенда ───
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_CUT_API_TOKEN=
RUN if [ -n "$VITE_CUT_API_TOKEN" ]; then \
      printf 'VITE_CUT_API_TOKEN=%s\n' "$VITE_CUT_API_TOKEN" > .env.production; \
    fi
RUN npm run build

# ─── Этап 2: Продакшен-сервер ───
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /var/cache/nginx && \
    mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
