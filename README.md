# Network of Terms Catalog

This is the catalog of datasets that you can query through the
[Network of Terms](https://github.com/netwerk-digitaal-erfgoed/network-of-terms-comunica).

The [catalog](catalog/) directory contains all datasets.
Each is described in the [Schema.org](https://schema.org) ontology.

The [queries](catalog/queries/) directory contains SPARQL queries for retrieving terms from the datasets.

## Adding a dataset

* Create a `your-dataset.jsonld` file in the `catalog/` directory and add a description.
* Create a `your-dataset.rq` in the `queries/` directory to hold the SPARQL query.
* Run the tests to make sure your dataset description conforms to the [dataset SHACL](shacl/dataset.jsonld):
  ```
  npm install
  npm run test
  ```
