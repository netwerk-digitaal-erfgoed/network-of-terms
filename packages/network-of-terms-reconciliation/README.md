# Network of Terms Reconciliation Service API

This package is a [Reconciliation Service API](https://reconciliation-api.github.io/specs/latest/)
for the [Network of Terms](http://github.com/netwerk-digitaal-erfgoed/network-of-terms).

## For developers

Run the application locally using Node:

```
https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
npm install
cd packages/network-of-terms-reconciliation
npm run dev
```

## Docker

If you want to run the Reconciliation Service API locally, or host it yourself, you can run our Docker image:

    docker run -p 3123:3123 ghcr.io/netwerk-digitaal-erfgoed/network-of-terms-reconciliation

Reconciliation endpoints will then be available at: `http://localhost:3123/reconcile/{distribution URI}`, for example
http://localhost:3123/reconcile/https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql. Note that the Network of
Terms provides Reconciliation endpoints only for terminology sources that do not provide such endpoints themselves.

Configure one or more Reconciliation endpoints in your [OpenRefine](https://openrefine.org) application to reconcile
strings in your data with terms from the Network of Terms.
