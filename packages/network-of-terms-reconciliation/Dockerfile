FROM node:lts-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY ../.. .
RUN NODE_ENV=production npm run compile

FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app/
COPY package*.json ./
RUN npm ci
COPY --from=build /app/build /app/build
USER node
CMD ["npm", "start"]
EXPOSE 3123
