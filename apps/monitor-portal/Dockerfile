FROM node:20-slim AS build
WORKDIR /repo
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/monitor-portal/package.json apps/monitor-portal/package.json
RUN npm install --workspace=@monitor-librechat/monitor-portal --workspace=@monitor-librechat/shared
COPY packages/shared packages/shared
COPY apps/monitor-portal apps/monitor-portal
RUN npm run build --workspace=@monitor-librechat/shared
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace=@monitor-librechat/monitor-portal

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/monitor-portal/dist /usr/share/nginx/html
EXPOSE 8080
COPY apps/monitor-portal/nginx.conf /etc/nginx/conf.d/default.conf
