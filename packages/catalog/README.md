# Network of Terms Catalog

This is the catalog of terminology sources that can be queried through the
[Network of Terms](https://github.com/netwerk-digitaal-erfgoed/network-of-terms).

## File layout

The [catalog](catalog) directory holds everything that defines the set of terminology sources:

```
catalog/
├── publishers.jsonld         # organizations that publish the terminology sources
├── datasets/
│   └── <dataset>.jsonld      # one file per terminology source
└── queries/
    ├── search/<dataset>.rq   # SPARQL CONSTRUCT for textual search
    └── lookup/<dataset>.rq   # SPARQL CONSTRUCT for URI lookup
```

- `publishers.jsonld` is a single JSON-LD graph of [`schema:Organization`](https://schema.org/Organization) entries. Datasets reference a publisher by `@id` via `schema:creator`.
- Each file under `datasets/` describes one source as a [`schema:Dataset`](https://schema.org/Dataset) with one or more `schema:DataDownload` distributions.
- Each distribution’s `schema:potentialAction` entries point at the matching `.rq` files under `queries/search/` and `queries/lookup/`.

## Data model

Each terminology source is modelled as a [Schema.org Dataset](https://schema.org/Dataset).

Most of the dataset’s properties match the
[NDE Requirements for Datasets](https://netwerk-digitaal-erfgoed.github.io/requirements-datasets), with the following
additions specific to the Network of Terms:

- `schema:url` is used for the HTTP URI prefix of terms in the dataset, e.g. `http://vocab.getty.edu/aat/` for Getty
  resources. This prefix is needed when clients look up terms by their URI in the Network of Terms: the Network then has
  to know which source to consult to retrieve the term;
- `schema:inLanguage` is a required property;
- `schema:genre` is a required property, with values restricted to the list of [Termennetwerk onderwerpen](https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen.html);
- `schema:mainEntityOfPage` is a required property;
- each distribution is a [`schema:DataDownload`](https://schema.org/DataDownload) with `schema:contentUrl` pointing at the SPARQL endpoint and `schema:encodingFormat` set to `application/sparql-query`;
- each distribution has two or more [`schema:potentialAction`](https://schema.org/potentialAction)s:
  - a [`schema:SearchAction`](https://schema.org/SearchAction) and
    a [`schema:FindAction`](https://schema.org/FindAction), both with a [`schema:query`](https://schema.org/query)
    property that points to the queries directory;
  - optionally, a number of [`schema:Action`](https://schema.org/Action)s that configure the features that the Network
    of Terms provides for the distribution, such as [Reconciliation](../reconciliation).

The [queries](catalog/queries) directory contains SPARQL queries for retrieving terms from the datasets. There are
two types of queries:

- [search queries](catalog/queries/search) find terms matching a textual string query input;
- [lookup queries](catalog/queries/lookup) retrieve a single term based on its URI.

## Contributing

### Adding a dataset

A terminology source can be added to the catalog when:

- the source is available as a public SPARQL endpoint;
- it publishes at least a URI and a label for each term;
- it complies with the [Requirements for terminologiebronnen](https://docs.nde.nl/requirements-terminologiebronnen/) (in Dutch).

To add it:

- If the dataset’s publisher isn’t in `catalog/publishers.jsonld` yet, add a `schema:Organization` entry for it.
- Create a `your-dataset.jsonld` file in the `catalog/datasets` directory and add a description. Use an existing dataset such as [`aat-materials.jsonld`](catalog/datasets/aat-materials.jsonld) as a template.
- Create a `your-dataset.rq` file in the `queries/search` directory and add your SPARQL search query. A SPARQL
  lookup query goes into the `queries/lookup` directory.
  - If your SPARQL server supports fulltext search relevance scores, you can return them as `vrank:simpleRank` values to
    have search results ordered by rank instead of the default, alphabetical order.
- [Run the tests](../../docs/tests.md) to make sure your dataset description conforms to the
  [dataset SHACL](shacl/dataset.jsonld).
- To try your queries locally, you can
  [run the GraphQL API](../graphql/README.md#for-network-of-terms-developers) with your catalog.

