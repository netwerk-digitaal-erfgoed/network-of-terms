# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Build, Test, and Lint Commands

This is an Nx monorepo. All commands use Nx target execution.

```bash
npx nx <target> <project>                 # Single project
npx nx run-many -t <target> --all         # All projects
npx nx affected -t <target>               # Prefer this for efficiency: changed projects only

# Targets: build, test, lint, typecheck, serve
```

Project names are short and match the conventional-commit scopes: `catalog`, `query`, `graphql`, `reconciliation`, `status`, `cli` (set via `nx.name` in each package’s `package.json`; the npm package name keeps the `@netwerk-digitaal-erfgoed/network-of-terms-` prefix). Scoping a commit to a project name is what lets `nx release` apply that commit’s type – `feat`, `fix`, `!` – to the project’s version bump; a scope that matches no project falls through to a patch.

## Architecture

Network of Terms is a search engine for terminology sources (thesauri, classification systems). It queries sources in real-time and returns SKOS-harmonized results.

### Package Dependencies

```
graphql ────────┐
                ├──> catalog ──> query
reconciliation ─┤
cli ────────────┘
```

**Libraries:**

- **query** - Core query engine. Executes SPARQL queries against terminology sources. Uses Comunica for query execution.
- **catalog** - Catalog of terminology sources. Contains JSONLD dataset definitions and SPARQL query templates in `catalog/` subdirectory.

**Applications:**

- **graphql** - Fastify/Mercurius GraphQL API server
- **reconciliation** - OpenRefine-compatible Reconciliation Service API
- **cli** - Command-line interface (oclif)

### Key Patterns

- Terminology sources are defined as JSON-LD files in `packages/catalog/catalog/` with companion SPARQL query files
- SHACL schemas in `packages/catalog/shacl/` validate catalog entries
- Environment validation uses `env-schema` (Fastify ecosystem)
- Logging via Pino, metrics via OpenTelemetry

## Development Notes

- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint)
- Tests use Vitest with v8 coverage
- When debugging Nx issues, set `NX_VERBOSE_LOGGING=true`
- TypeScript project references in tsconfig.json files are managed by Nx sync
