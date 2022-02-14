# Network of Terms

The Network is a **search engine for finding terms** in terminology sources (such as thesauri, classification systems
and reference lists).

Given a textual search query, the Network of Terms searches one or more terminology sources in
**real-time** and returns matching terms, including their labels and URIs. The Network of Terms offers a **simple search
interface**, **handles errors** gracefully in case a source does not respond well and **harmonizes the results** to the
SKOS data model.

The Network of Terms is intended for managers of heritage information that want to improve the findability of their
information by assigning terms from terminology sources that are used by the institutions in
the [Dutch Digital Heritage Network](https://netwerkdigitaalerfgoed.nl).

## Getting started

### Web interface

If you just want to search the Network of Terms using a web interface, have a look at our
[demonstrator](https://termennetwerk.netwerkdigitaalerfgoed.nl), a web interface on top of this API.

### Packages

This repository contains the following packages:

- [network-of-terms-catalog](packages/network-of-terms-catalog): the catalog of terminology sources in the Network of
  Terms that can be queried;
- [network-of-terms-cli](packages/network-of-terms-cli): query the Network of Terms from the command line;
- [network-of-terms-graphql](packages/network-of-terms-graphql): a GraphQL query API to find terms;
- [network-of-terms-query](packages/network-of-terms-query): core query logic which executes the queries to terminology
  sources;
- [network-of-terms-reconciliation](packages/network-of-terms-reconciliation): a Reconciliation API for matching strings
  against terms with URIs.


## Running the tests

For simplicity and because we have integration tests (versus full unit tests for each package) we want to combine
coverage for all tests.
TODO: For coverage reasons, we run all the tests
