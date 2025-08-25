# Network of Terms GraphQL API

This application delivers a [GraphQL](https://graphql.org) API for searching the Network of Terms.

## For users

If you want to try the Network of Terms GraphQL API, have a look at the GraphQL playground at
https://termennetwerk-api.netwerkdigitaalerfgoed.nl/graphiql.

For the Network of Terms web interface, see http://termennetwerk.netwerkdigitaalerfgoed.nl.

## For application developers

Developers that want to implement terms search/lookup in their (collection management) software can benefit from the
Network of Terms. By connecting their client to a single GraphQL API, developers get access to a large and growing
number of terminology sources. The Network of Terms **abstracts the complexity of the sources away**. While sources  
require different queries and ways of harmonizing the results, they can be consulted through the Network of Terms with a
single GraphQL query that returns the results consolidated into the SKOS data model.

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

### Running your own instance

To run your own instance of the Network of Terms GraphQL API with a custom [catalog](../network-of-terms-catalog)
(set of terminology sources and term queries):

1. create your custom catalog that matches the data structure of the [default catalog](../network-of-terms-catalog/catalog)
2. provide the path to your custom catalog in the `CATALOG_PATH` environment variable when starting the server:
    
       CATALOG_PATH=my-custom-catalog/ npm run start

## GraphQL API

The GraphQL API is documented at https://docs.nde.nl/services/network-of-terms/graphql.
