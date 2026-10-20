FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
ENV GATEWAY_UPSTREAM=http://gateway:8080
ENV DOCS_UPSTREAM=http://api-docs:8080
ENV NGINX_ENVSUBST_FILTER="^(GATEWAY_UPSTREAM|DOCS_UPSTREAM)$"
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html/admin
COPY web /usr/share/nginx/html/site
EXPOSE 8080
