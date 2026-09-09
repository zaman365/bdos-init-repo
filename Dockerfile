# BDOS application image.
#
# Single stage on purpose: scripts/migrate.ts and scripts/seed.ts import lib/
# as source, so a `next build --output standalone` runtime cannot run them.
# Keeping node_modules and the sources means `npm run db:migrate` works as a
# release command on any host.
#
# This app needs a real Node server, not an edge runtime: lib/media.ts writes
# uploads with node:fs and transcodes with node:child_process. It therefore
# cannot run on Cloudflare Pages or Workers — see docs/12-DEPLOYMENT.md.
FROM node:22-bookworm-slim

# tini so SIGTERM reaches Node and in-flight requests drain on deploy.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/.data/media && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3000

# ffmpeg comes from the ffmpeg-static dependency, selected by FFMPEG_PATH=bundled.
ENV FFMPEG_PATH=bundled

# The host needs a real readiness signal: /api/health checks the database too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["npm", "run", "start"]
