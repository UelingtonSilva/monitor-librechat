# Single image: the API also serves the built portal from the same origin.
# Why: on a platform that gates access behind identity-aware infrastructure (e.g. Cloud
# Run with IAM), two separate services would mean the browser's JS needs an identity token
# to call the API — which it doesn't have. With one origin, the platform authenticates once
# and the portal calls /api/v1/* with no CORS and no token.
FROM node:20-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/monitor-api/package.json apps/monitor-api/package.json
COPY apps/monitor-portal/package.json apps/monitor-portal/package.json
RUN npm ci
COPY packages/shared packages/shared
COPY apps/monitor-api apps/monitor-api
COPY apps/monitor-portal apps/monitor-portal
RUN npm run build --workspace=@monitor-librechat/shared \
 && npm run build --workspace=@monitor-librechat/monitor-api \
 && npm run build --workspace=@monitor-librechat/monitor-portal

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV POLICIES_DIR=/app/policies
ENV PORTAL_DIR=/app/portal
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/monitor-api/dist ./dist
COPY --from=build /repo/apps/monitor-api/package.json ./package.json
COPY --from=build /repo/apps/monitor-portal/dist ./portal
COPY policies ./policies
EXPOSE 4000
CMD ["node", "dist/index.js"]
