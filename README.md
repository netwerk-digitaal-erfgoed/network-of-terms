Prototype: [Network of Terms](https://www.netwerkdigitaalerfgoed.nl/en/knowledge-services/usable-digital-heritage/network-of-terms/) and [Comunica](https://comunica.linkeddatafragments.org/)
==============================

This experimental application is published for examination and evaluation. It is not an official implementation.

## Build image

    docker-compose build --no-cache

## Logon to container

    docker-compose run --rm node /bin/bash

## List queryable dataset distributions

This command reads the catalog information in file `configs/catalog.ttl`.

    ./bin/run distributions:list

## Query one or more dataset distributions

```bash
# Cultuurhistorische Thesaurus: query SPARQL endpoint
./bin/run distributions:query --identifiers cht-sparql --search-terms fiets

# RKDartists: query SPARQL endpoint
./bin/run distributions:query --identifiers rkdartists-sparql --search-terms Gogh

# Cultuurhistorische Thesaurus and RKDartists: query SPARQL endpoints simultaneously
./bin/run distributions:query --identifiers cht-sparql,rkdartists-sparql --search-terms Gogh

# NTA: query SPARQL endpoint
./bin/run distributions:query --identifiers nta-sparql --search-terms Wieringa
./bin/run distributions:query --identifiers nta-sparql --search-terms "'Wier*'"
./bin/run distributions:query --identifiers nta-sparql --search-terms "Wieringa OR Mulisch"
./bin/run distributions:query --identifiers nta-sparql --search-terms "Jan AND Vries"

# NMvW: query SPARQL endpoint
./bin/run distributions:query --identifiers nmvw-sparql --search-terms eiland

# AAT: query SPARQL endpoint
./bin/run distributions:query --identifiers aat-sparql --search-terms schilderij
./bin/run distributions:query --identifiers aat-sparql --search-terms "schil*"
./bin/run distributions:query --identifiers aat-sparql --search-terms "schilderij OR tekening"
./bin/run distributions:query --identifiers aat-sparql --search-terms "cartoon* OR prent*"

# Wikidata Entities: query SPARQL endpoint
./bin/run distributions:query --identifiers wikidata-entities-sparql --search-terms Rembrandt
```

Add `--loglevel` to the commands to see what's going on underneath. For example:

    ./bin/run distributions:query --identifiers cht-sparql --search-terms fiets --loglevel info

Search results are piped to stdout. Redirect these elsewhere for further analysis. For example:

    ./bin/run distributions:query --identifiers cht-sparql --search-terms fiets > cht.txt

## Use Comunica directly

```bash
npx comunica-sparql \
    sparql@https://api.data.netwerkdigitaalerfgoed.nl/datasets/rkd/rkdartists/services/rkdartists/sparql \
    -q "SELECT * WHERE { ?uri schema:name ?label . ?label <bif:contains> 'gogh' } LIMIT 10"
```
