# Network of Terms CLI

```
npm install @netwerk-digitaal-erfgoed/network-of-terms-cli
```

## Query sources via CLI

### Logon to container

    docker-compose run --rm --entrypoint /bin/sh node

### List queryable sources

    bin/run.js sources:list

### Query one or more sources for terms

```bash
# Cultuurhistorische Thesaurus: query SPARQL endpoint
bin/run.js sources:query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets

# RKDartists: query SPARQL endpoint
bin/run.js sources:query --uris https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql --query Gogh

# RKDartists and NTA: query SPARQL endpoints simultaneously
bin/run.js sources:query --uris https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql,http://data.bibliotheken.nl/thesp/sparql --query Gogh

# NTA: query SPARQL endpoint
bin/run.js sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query Wieringa
bin/run.js sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query "'Wier*'"
bin/run.js sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query "Wieringa OR Mulisch"
bin/run.js sources:query --uris http://data.bibliotheken.nl/thesp/sparql --query "Jan AND Vries"

# NMvW: query SPARQL endpoint
bin/run.js sources:query --uris https://data.netwerkdigitaalerfgoed.nl/NMVW/thesaurus/sparql --query eiland

# AAT: query SPARQL endpoint
bin/run.js sources:query --uris http://vocab.getty.edu/aat/sparql --query schilderij
bin/run.js sources:query --uris http://vocab.getty.edu/aat/sparql --query "schil*"
bin/run.js sources:query --uris http://vocab.getty.edu/aat/sparql --query "schilderij OR tekening"
bin/run.js sources:query --uris http://vocab.getty.edu/aat/sparql --query "cartoon* OR prent*"

# Wikidata Entities: query SPARQL endpoint
bin/run.js sources:query --uris https://query.wikidata.org/sparql#entities-all --query Rembrandt
```

Add `--loglevel` to the commands to see what's going on underneath. For example:

    bin/run.js sources:query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets --loglevel info

Search results are piped to stdout. Redirect these elsewhere for further analysis. For example:

    bin/run.js sources:query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets > cht.txt

