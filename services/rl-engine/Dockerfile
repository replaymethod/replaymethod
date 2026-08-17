FROM node:22.22.0-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY services/rl-engine ./services/rl-engine
USER node
EXPOSE 8788
CMD ["node", "services/rl-engine/server.mjs"]
