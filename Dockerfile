FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/.data/media && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
