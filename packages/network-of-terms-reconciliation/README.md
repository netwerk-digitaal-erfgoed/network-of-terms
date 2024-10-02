# Network of Terms Reconciliation Service API

This package is a [Reconciliation Service API](https://reconciliation-api.github.io/specs/latest/)
for the [Network of Terms](http://github.com/netwerk-digitaal-erfgoed/network-of-terms).

You can use it to **match and reconcile textual strings in your data with terms** from the Network of Terms.

## For users

If you want to use the Reconciliation Service API, configure one or more service endpoints in your
[OpenRefine](https://openrefine.org) application. An endpoint’s URL is structured like
`https://termennetwerk-api.netwerkdigitaalerfgoed.nl/reconcile/{sourceUri}`. A full list of endpoints can be found in
the [Network of Terms FAQ](https://termennetwerk.netwerkdigitaalerfgoed.nl/reconciliation).

Note that the Network of Terms provides Reconciliation endpoints only for terminology sources that do not provide such
endpoints themselves.

## For developers

If you want to run the application locally, or host it yourself, you can use our
[Docker image](https://github.com/netwerk-digitaal-erfgoed/network-of-terms/pkgs/container/network-of-terms-reconciliation):

    docker run -p 3123:3123 ghcr.io/netwerk-digitaal-erfgoed/network-of-terms-reconciliation

If you want to make changes to the application, run it locally using Node (or in a
[Docker container](../../docs/docker.md)):

    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms
    npm install
    cd packages/network-of-terms-reconciliation
    npm run dev

In both cases, Reconciliation endpoints will be available at `http://localhost:3123/reconcile/{distribution URI}`, for
example http://localhost:3123/reconcile/https://data.rkd.nl/rkdartists.

See [Running the tests](../../docs/tests.md) for more information about this repository’s test suite.
