FROM node:lts-alpine
LABEL org.opencontainers.image.source="https://github.com/netwerk-digitaal-erfgoed/dataset-register"

WORKDIR /app

COPY dist/package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./

USER node
CMD ["node", "main.js"]
EXPOSE 3000
