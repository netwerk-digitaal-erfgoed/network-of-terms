# Network of Terms CLI

Query the [Network of Terms](../../README.md) from the command line.

## For Network of Terms developers

If you want to make changes to the Network of Terms code or catalog, the best way to get started is to run the
application locally using Node (or in a [Docker container](../../docs/docker.md)):

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms    
    npm install
    # Explicit compilation is needed because the Open CLI Framework (oclif) doesn't support dev with ESM yet:
    npm run compile
    cd packages/network-of-terms-cli

In that directory, you can run the commands as seen below.

## Commands

### List queryable sources

    bin/run.js list

### Query one or more sources for terms

```bash
# Cultuurhistorische Thesaurus: query SPARQL endpoint
bin/run.js query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets

# RKDartists: query SPARQL endpoint
bin/run.js query --uris https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql --query Gogh

# RKDartists and NTA: query SPARQL endpoints simultaneously
bin/run.js query --uris https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql,http://data.bibliotheken.nl/thesp/sparql --query Gogh

# NTA: query SPARQL endpoint
bin/run.js query --uris http://data.bibliotheken.nl/thesp/sparql --query Wieringa
bin/run.js query --uris http://data.bibliotheken.nl/thesp/sparql --query "'Wier*'"
bin/run.js query --uris http://data.bibliotheken.nl/thesp/sparql --query "Wieringa OR Mulisch"
bin/run.js query --uris http://data.bibliotheken.nl/thesp/sparql --query "Jan AND Vries"

# NMvW: query SPARQL endpoint
bin/run.js query --uris https://data.netwerkdigitaalerfgoed.nl/NMVW/thesaurus/sparql --query eiland

# AAT: query SPARQL endpoint
bin/run.js query --uris http://vocab.getty.edu/aat/sparql --query schilderij
bin/run.js query --uris http://vocab.getty.edu/aat/sparql --query "schil*"
bin/run.js query --uris http://vocab.getty.edu/aat/sparql --query "schilderij OR tekening"
bin/run.js query --uris http://vocab.getty.edu/aat/sparql --query "cartoon* OR prent*"

# Wikidata Entities: query SPARQL endpoint
bin/run.js query --uris https://query.wikidata.org/sparql#entities-all --query Rembrandt
```

Add `--loglevel` to the commands to see what's going on underneath. For example:

    bin/run.js query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets --loglevel info

Search results are piped to stdout. Redirect these elsewhere for further analysis. For example:

    bin/run.js query --uris https://data.cultureelerfgoed.nl/PoolParty/sparql/term/id/cht --query fiets > cht.txt

