# Network of Terms GraphQL API

This application delivers a [GraphQL](https://graphql.org) API for searching the Network of Terms.

## For users

If you want to try the Network of Terms GraphQL API, have a look at the GraphQL playground at
https://termennetwerk-api.netwerkdigitaalerfgoed.nl/graphiql.

For the Network of Terms web interface, see http://termennetwerk.netwerkdigitaalerfgoed.nl.

## For application developers

If you’re a developer and want to use the Network of Terms GraphQL API in your apps, you can connect your apps to the
endpoint at https://termennetwerk-api.netwerkdigitaalerfgoed.nl/graphql.

To try out queries, have a look at the GraphQL playground at https://termennetwerk-api.netwerkdigitaalerfgoed.nl.

If you want to run the application locally, or host it yourself, you can use our
[Docker image](https://github.com/netwerk-digitaal-erfgoed/network-of-terms/pkgs/container/network-of-terms-graphql):

    docker run -p 3123:3123 ghcr.io/netwerk-digitaal-erfgoed/network-of-terms-graphql

and open http://localhost:3123 in your browser for the GraphQL Playground. See below for some example queries.

## For Network of Terms developers

If you want to make changes to the Network of Terms code or catalog, the best way to get started is to run the 
application locally using Node (or in a [Docker container](../../docs/docker.md)):

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms    
    npm install
    cd packages/network-of-terms-graphql
    npm run dev

and open http://localhost:3123 in your browser for the GraphQL Playground. See below for some example queries.

See [Running the tests](../../docs/tests.md) for more information about this repository’s test suite.

## GraphQL queries

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
