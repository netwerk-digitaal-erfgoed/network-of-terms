# Network of Terms GraphQL API

This application delivers a [GraphQL](https://graphql.org) API and command-line interface
for searching the Network of Terms. It is available at https://termennetwerk-api.netwerkdigitaalerfgoed.nl.

### GraphQL endpoint

If you’re a developer and want to use the Network of Terms API in your apps,
you can test the API and try GraphQL queries at the [API Playground](https://termennetwerk-api.netwerkdigitaalerfgoed.nl).

You can connect your client apps to the [GraphQL endpoint](https://termennetwerk-api.netwerkdigitaalerfgoed.nl/graphql).

### Host it yourself

If you want to run the Network of Terms locally, or host it yourself, you can run our Docker image:

    docker run -p 3123:3123 ghcr.io/netwerk-digitaal-erfgoed/network-of-terms-api

and open http://localhost:3123 in your browser for the API Playground.

While this repository follows [Semantic Versioning](https://semver.org), you may want to stick to a
[tagged version](https://github.com/netwerk-digitaal-erfgoed/network-of-terms-api/releases):

    docker run -p 3123:3123 ghcr.io/netwerk-digitaal-erfgoed/network-of-terms-api:v1.7.0

### Contribute

If you want to contribute to this repository, please continue reading.

## Build image

    docker-compose build --no-cache

## Query sources via GraphQL

### Start server

    docker-compose up --build

### Open the GraphQL editor

http://localhost:3123/graphiql

### List queryable sources

```graphql
query Sources {
  sources {
    uri
    name
    alternateName
    creators {
      uri
      name
      alternateName
    }
  }
}
```

### Query one or more sources for terms

#### Query a single source

```graphql
# Query Cultuurhistorische Thesaurus (CHT)
query {
  terms(
    sources: ["https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht"],
    query: "fiets",
    queryMode: OPTIMIZED   # Forwards-compatible query type.
  ) {
    source {
      uri
      name
      creators {
        uri
        name
        alternateName
      }
    }
    result {
      __typename
      ... on Terms {
        terms {
          uri
          prefLabel
          altLabel
          hiddenLabel
          scopeNote
          seeAlso
          broader {
            uri
            prefLabel
          }
          narrower {
            uri
            prefLabel
          }
          related {
            uri
            prefLabel
          }
        }
      }
      ... on Error {
        message
      }
    }
  }
}
```

#### Query multiple sources

```graphql
# Query RKDartists and NTA simultaneously
query {
  terms(
    sources: ["https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql", "http://data.bibliotheken.nl/thesp/sparql"],
    query: "Gogh",
    queryMode: OPTIMIZED   # Forwards-compatible query type.
  ) {
    source {
      uri
      name
      creators {
        uri
        name
        alternateName
      }
    }
    result {
      __typename
      ... on Terms {
        terms {
          uri
          prefLabel
          altLabel
          hiddenLabel
          scopeNote
          seeAlso
        }
      }
      ... on Error {
        message
      }
    }
  }
}
```

### Look up terms by URI

Use the `lookup` query to look up terms whose URIs you know (for example, because you have stored the URIs previously):

```graphql
query {
  lookup(
    uris: ["https://data.rkd.nl/artists/32439", "https://data.cultureelerfgoed.nl/term/id/cht/15e29ea3-1b4b-4fb2-b970-a0c485330384"],
  ) {
    uri
    source {
      ... on Source {
        uri
        name
        creators {
          uri
          name
          alternateName
        }
      }
      ... on Error {
        __typename
        message
      }
    }        
    result {
      ... on Term {
        uri
        prefLabel
        altLabel
        hiddenLabel
        scopeNote
        seeAlso
        broader {
          uri
          prefLabel
        }
      }
      ... on Error {
        __typename
        message
      }
    }
  }
}
```
