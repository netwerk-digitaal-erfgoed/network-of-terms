FROM node:lts-alpine AS build
ARG PACKAGE_DIR
WORKDIR /app

# Without this ‘npm run compile’ fails because of missing dependencies.
COPY packages/network-of-terms-catalog/package.json packages/network-of-terms-catalog/

# Install devDependencies from the root package-lock.json that we need for compiling the workspace package.
COPY package*.json ./
RUN npm ci

# Install the workspace’s dependencies. Any dependencies on other internal workspaces must be published packages.
# Workspaces have no package-lock.json so we must use npm install rather than npm ci.
COPY $PACKAGE_DIR/package.json ./$PACKAGE_DIR/
RUN npm install --prefix $PACKAGE_DIR

COPY . .
RUN NODE_ENV=production npm run compile --workspace $PACKAGE_DIR

FROM node:lts-alpine
LABEL org.opencontainers.image.source = "https://github.com/netwerk-digitaal-erfgoed/network-of-terms"
ARG PACKAGE_DIR
ENV NODE_ENV=production
WORKDIR /app/

# Install production dependencies only.
COPY $PACKAGE_DIR/package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy build artifacts.
COPY --from=build /app/$PACKAGE_DIR/build ./build

USER node
CMD ["npm", "start"]
EXPOSE 3123
