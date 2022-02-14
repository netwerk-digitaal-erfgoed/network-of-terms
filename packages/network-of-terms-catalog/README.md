# Network of Terms Catalog

This is the catalog of datasets that you can query through the
[Network of Terms](https://github.com/netwerk-digitaal-erfgoed/network-of-terms).

The [catalog](catalog/) directory contains all datasets.
Each is described in the [Schema.org](https://schema.org) ontology.

The [queries](catalog/queries/) directory contains SPARQL queries for retrieving terms from the datasets.

## Installation

This package is [available on NPM](https://www.npmjs.com/package/@netwerk-digitaal-erfgoed/network-of-terms-catalog):

```
npm add @netwerk-digitaal-erfgoed/network-of-terms-catalog
```

## Contributing

### Adding a dataset

* Create a `your-dataset.jsonld` file in the `catalog/` directory and add a description.
* Create a `your-dataset.rq` file in the `queries/search` directory and add your SPARQL search query. A SPARQL
  lookup goes into the `queries/lookup` directory.
* Run the tests to make sure your dataset description conforms to the [dataset SHACL](shacl/dataset.jsonld):
  ```
  npm install
  npm run test
  ```

### Committing changes

This repository follows [Semantic Versioning](https://semver.org). Tags and 
[releases](https://github.com/netwerk-digitaal-erfgoed/network-of-terms-catalog/releases) are
[created automatically](https://github.com/netwerk-digitaal-erfgoed/network-of-terms-catalog/blob/master/.github/workflows/release.yml)
based on commit messages. 
So please make sure to follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#summary)
when committing changes.
