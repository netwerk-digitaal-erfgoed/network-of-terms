Prototype: [Network of Terms](https://www.netwerkdigitaalerfgoed.nl/en/knowledge-services/usable-digital-heritage/network-of-terms/) and [Comunica](https://comunica.linkeddatafragments.org/)
==============================

This experimental application is published for examination and evaluation. It is not an official implementation.

## Build image

    docker-compose build --no-cache

## Query sources via CLI

### Logon to container

    docker-compose run --rm --entrypoint /bin/sh node

### List queryable sources

    bin/run sources:list

### Query one or more sources for terms

```bash
# Cultuurhistorische Thesaurus: query SPARQL endpoint
bin/run sources:query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets

# RKDartists: query SPARQL endpoint
bin/run sources:query --uris https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql --query Gogh

# RKDartists and NTA: query SPARQL endpoints simultaneously
bin/run sources:query --uris https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql,http://data.bibliotheken.nl/thesp/sparql --query Gogh

# NTA: query SPARQL endpoint
bin/run sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query Wieringa
bin/run sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query "'Wier*'"
bin/run sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query "Wieringa OR Mulisch"
bin/run sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query "Jan AND Vries"

# NMvW: query SPARQL endpoint
bin/run sources:query --uris https://data.netwerkdigitaalerfgoed.nl/NMVW/thesaurus/sparql --query eiland

# AAT: query SPARQL endpoint
bin/run sources:query --uris http://vocab.getty.edu/aat/sparql --query schilderij
bin/run sources:query --uris http://vocab.getty.edu/aat/sparql --query "schil*"
bin/run sources:query --uris http://vocab.getty.edu/aat/sparql --query "schilderij OR tekening"
bin/run sources:query --uris http://vocab.getty.edu/aat/sparql --query "cartoon* OR prent*"

# Wikidata Entities: query SPARQL endpoint
bin/run sources:query --uris https://www.wikidata.org/sparql --query Rembrandt
```

Add `--loglevel` to the commands to see what's going on underneath. For example:

    bin/run sources:query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets --loglevel info

Search results are piped to stdout. Redirect these elsewhere for further analysis. For example:

    bin/run sources:query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets > cht.txt

## Query sources via GraphQL

### Start server

    docker-compose up --build

### Open the GraphQL editor

http://localhost:3123/playground

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

```graphql
# Query Cultuurhistorische Thesaurus (CHT)
query Terms {
  terms(sources: ["https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht"], query: "fiets") {
    source {
      uri
      name
      creators {
        uri
        name
        alternateName
      }
    }
    terms {
      uri
      prefLabel
      altLabel
      hiddenLabel
      scopeNote
    }
  }
}
```

```graphql
# Query RKDartists and NTA simultaneously
query Terms {
  terms(sources: ["https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql", "http://data.bibliotheken.nl/thesp/sparql"], query: "Gogh") {
    source {
      uri
      name
      creators {
        uri
        name
        alternateName
      }
    }
    terms {
      uri
      prefLabel
      altLabel
      hiddenLabel
      scopeNote
    }
  }
}
```
