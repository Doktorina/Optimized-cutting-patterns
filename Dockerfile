# ─── Этап 1: Сборка фронтенда ───
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ─── Этап 2: Продакшен-сервер ───
FROM nginx:alpine
# Копируем собранный фронтенд
COPY --from=build /app/dist /usr/share/nginx/html
# Конфиг nginx для SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Убедимся, что директория существует
RUN mkdir -p /var/cache/nginx && \
    mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
