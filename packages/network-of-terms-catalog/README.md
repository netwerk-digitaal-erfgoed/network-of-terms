# Network of Terms Catalog

This is the catalog of terminology sources that can be queried through the
[Network of Terms](https://github.com/netwerk-digitaal-erfgoed/network-of-terms).

The [catalog](catalog) directory contains all datasets.
Each is described in the [Schema.org](https://schema.org) ontology.

The [queries](catalog/queries) directory contains SPARQL queries for retrieving terms from the datasets. There are
two types of queries:

- [search queries](catalog/queries/search) find terms matching a textual string query input;
- [lookup queries](catalog/queries/lookup) retrieve a single term based on its URI.

## Contributing

### Adding a dataset

* Create a `your-dataset.jsonld` file in the `catalog/` directory and add a description.
* Create a `your-dataset.rq` file in the `queries/search` directory and add your SPARQL search query. A SPARQL
  lookup goes into the `queries/lookup` directory.
* [Run the tests](../../docs/tests.md) to make sure your dataset description conforms to the
  [dataset SHACL](shacl/dataset.jsonld).
* To try your queries locally, you can
  [run the GraphQL API](../network-of-terms-graphql/README.md#for-network-of-terms-developers) with your catalog.
