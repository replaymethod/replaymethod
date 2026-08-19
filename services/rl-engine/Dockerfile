FROM node:22.22.0-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8788
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node services/rl-engine ./services/rl-engine
USER node
EXPOSE 8788
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 8788}/healthz`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "services/rl-engine/server.mjs"]
