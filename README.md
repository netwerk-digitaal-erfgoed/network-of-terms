Prototype: [Network of Terms](http://demo.netwerkdigitaalerfgoed.nl/termennetwerk/en/faq) and [Comunica](https://comunica.linkeddatafragments.org/)
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
./bin/run distributions:query --identifiers cht-sparql --search-term fiets

# Cultuurhistorische Thesaurus: query (local) HDT file (slow)
./bin/run distributions:query --identifiers cht-hdt --search-term fiets

# RKDartists: query SPARQL endpoint
./bin/run distributions:query --identifiers rkdartists-sparql --search-term Gogh

# RKDartists: query TPF endpoint (slow)
./bin/run distributions:query --identifiers rkdartists-fragments --search-term Gogh

# RKDartists: query (local) HDT file (slow)
./bin/run distributions:query --identifiers rkdartists-hdt --search-term Gogh

# RKDartists: query SPARQL endpoint, TPF endpoint and HDT file simultaneously
./bin/run distributions:query --identifiers rkdartists-sparql,rkdartists-fragments,rkdartists-hdt --search-term Gogh

# DBpedia: query TPF endpoint (slow)
./bin/run distributions:query --identifiers dbpedia-astronomers-fragments --search-term Anton

# NTA: query SPARQL endpoint
./bin/run distributions:query --identifiers nta-sparql --search-term Wieringa
./bin/run distributions:query --identifiers nta-sparql --search-term "'Wier*'"
./bin/run distributions:query --identifiers nta-sparql --search-term "Wieringa OR Mulisch"
./bin/run distributions:query --identifiers nta-sparql --search-term "Jan AND Vries"

# NMvW: query SPARQL endpoint
./bin/run distributions:query --identifiers nmvw-sparql --search-term eiland

# AAT: query SPARQL endpoint
./bin/run distributions:query --identifiers aat-sparql --search-term schilderij
./bin/run distributions:query --identifiers aat-sparql --search-term "schil*"
./bin/run distributions:query --identifiers aat-sparql --search-term "schilderij OR tekening"
./bin/run distributions:query --identifiers aat-sparql --search-term "cartoon* AND prent*"

# Wikidata Entities: query SPARQL endpoint
./bin/run distributions:query --identifiers wikidata-entities-sparql --search-term Rembrandt
```

Add `--loglevel` to the commands to see what's going on underneath. For example:

    ./bin/run distributions:query --identifiers cht-sparql --search-term fiets --loglevel info

Search results - in Turtle - are piped to stdout. Redirect these elsewhere for further analysis. For example:

    ./bin/run distributions:query --identifiers cht-sparql --search-term fiets > cht.ttl

## Using Comunica directly

```bash
npx comunica-sparql \
    sparql@https://api.data.netwerkdigitaalerfgoed.nl/datasets/rkd/rkdartists/services/rkdartists/sparql \
    -q "SELECT * WHERE { ?uri schema:name ?label . ?label <bif:contains> 'gogh' } LIMIT 10"
```
