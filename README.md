Prototype: [Network of Terms](https://www.netwerkdigitaalerfgoed.nl/en/knowledge-services/usable-digital-heritage/network-of-terms/) and [Comunica](https://comunica.linkeddatafragments.org/)
==============================

This experimental application is published for examination and evaluation. It is not an official implementation.

## Build image

    docker-compose build --no-cache

## Query sources via CLI

### Logon to container

    docker-compose run --rm --entrypoint /bin/sh node

### List queryable sources

This command reads the catalog information in file `configs/catalog.ttl`.

    bin/run sources:list

### Query one or more sources for terms

```bash
# Cultuurhistorische Thesaurus: query SPARQL endpoint
bin/run sources:query --identifiers cht --query fiets

# RKDartists: query SPARQL endpoint
bin/run sources:query --identifiers rkdartists --query Gogh

# RKDartists and NTA: query SPARQL endpoints simultaneously
bin/run sources:query --identifiers rkdartists,nta --query Gogh

# NTA: query SPARQL endpoint
bin/run sources:query --identifiers nta --query Wieringa
bin/run sources:query --identifiers nta --query "'Wier*'"
bin/run sources:query --identifiers nta --query "Wieringa OR Mulisch"
bin/run sources:query --identifiers nta --query "Jan AND Vries"

# NMvW: query SPARQL endpoint
bin/run sources:query --identifiers nmvw --query eiland

# AAT: query SPARQL endpoint
bin/run sources:query --identifiers aat --query schilderij
bin/run sources:query --identifiers aat --query "schil*"
bin/run sources:query --identifiers aat --query "schilderij OR tekening"
bin/run sources:query --identifiers aat --query "cartoon* OR prent*"

# Wikidata Entities: query SPARQL endpoint
bin/run sources:query --identifiers wikidata-entities --query Rembrandt
```

Add `--loglevel` to the commands to see what's going on underneath. For example:

    bin/run sources:query --identifiers cht --query fiets --loglevel info

Search results are piped to stdout. Redirect these elsewhere for further analysis. For example:

    bin/run sources:query --identifiers cht --query fiets > cht.txt

## Query sources via GraphQL

### Start server

    docker-compose up --build

### Open the GraphQL editor

http://localhost:3123/playground

### List queryable sources

```
query Sources {
  sources {
    name
    identifier
  }
}
```

### Query one or more sources for terms

```
# Query Cultuurhistorische Thesaurus (CHT)
query Terms {
  terms(sources: ["cht"], query: "fiets") {
    source {
      identifier
      name
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

```
# Query RKDartists and NTA simultaneously
query QueryTerms {
  terms(sources: ["rkdartists", "nta"], query: "Gogh") {
    source {
      identifier
      name
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
