# Network of Terms Catalog

This is the catalog of terminology sources that can be queried through the
[Network of Terms](https://github.com/netwerk-digitaal-erfgoed/network-of-terms).

## Data model

Each terminology source is modelled as a [Schema.org Dataset](https://schema.org/Dataset). The [catalog](catalog)
directory contains all datasets.

Most of the dataset’s properties match the
[NDE Requirements for Datasets](https://netwerk-digitaal-erfgoed.github.io/requirements-datasets), with the following
additions specific to the Network of Terms:

- `schema:url` is used for the HTTP URI prefix of terms in the dataset, e.g. `http://vocab.getty.edu/aat/` for Getty
  resources. This prefix is needed when clients look up terms by their URI in the Network of Terms: the Network then has 
  to know which source to consult to retrieve the term.
- Each distribution has two or more [`schema:potentialAction`](https://schema.org/potentialAction)s:
  - a [`schema:SearchAction`](https://schema.org/SearchAction) and
    a [`schema:FindAction`](https://schema.org/FindAction), both with a [`schema:query`](https://schema.org/query)
    property that points to the queries directory;
  - optionally, a number of [`schema:Action`](https://schema.org/Action)s that configure the features that the Network
    of Terms provides for the distribution, such as [Reconciliation](../network-of-terms-reconciliation).

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
