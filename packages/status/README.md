# Network of Terms Status

This service monitors the availability of SPARQL endpoints for terminology sources in the [Network of Terms](../../README.md). It periodically checks each endpoint and exposes the results as an [LDES](https://semiceu.github.io/LinkedDataEventStreams/) (Linked Data Event Stream).

## How it works

The status service:

1. Loads the catalog of terminology sources
2. Extracts SPARQL endpoints and queries from each dataset
3. Periodically executes test queries against each endpoint
4. Stores observation results in PostgreSQL
5. Exposes the latest observations via HTTP with RDF content negotiation

The [GraphQL API](../graphql) consumes this service to show source availability in query results.

## Running the service

### Using Docker

    docker run -p 3000:3000 \
      -e DATABASE_URL=postgres://user:pass@host:5432/db \
      ghcr.io/netwerk-digitaal-erfgoed/network-of-terms-status

### Using Node

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms
    npm install
    npx nx serve network-of-terms-status

## Configuration

Configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | `3000` | HTTP server port |
| `POLLING_INTERVAL_SECONDS` | No | `300` | Interval between checks (5 minutes) |
| `RUN_ON_START` | No | `true` | Run initial check on startup |
| `LDES_BASE_URL` | No | `https://termennetwerk-api.netwerkdigitaalerfgoed.nl/status` | Base URL for LDES stream IRIs |

## HTTP API

### `GET /`

Returns LDES stream metadata with a link to the view.

### `GET /observations/latest`

Returns the latest availability observations for all monitored endpoints. Supports RDF content negotiation (Turtle, JSON-LD, etc.).

### `GET /health`

Returns `{ "status": "ok" }` for health checks.

## Database

The service requires a PostgreSQL database. The schema is managed by the `@lde/sparql-monitor` library and is created automatically on first run.
