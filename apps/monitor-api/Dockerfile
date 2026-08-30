FROM node:20-slim AS build
WORKDIR /repo
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/monitor-api/package.json apps/monitor-api/package.json
RUN npm install --workspace=@monitor-librechat/monitor-api --workspace=@monitor-librechat/shared
COPY packages/shared packages/shared
COPY apps/monitor-api apps/monitor-api
RUN npm run build --workspace=@monitor-librechat/shared
RUN npm run build --workspace=@monitor-librechat/monitor-api

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV POLICIES_DIR=/app/policies
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/monitor-api/dist ./dist
COPY --from=build /repo/apps/monitor-api/package.json ./package.json
COPY policies ./policies
EXPOSE 4000
CMD ["node", "dist/index.js"]
