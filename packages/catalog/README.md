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
  to know which source to consult to retrieve the term. If the dataset is a subset of a broader dataset in the same URI
  space (e.g. ‘Wikidata: persons’ is a subset of ‘Wikidata: all entities’), omit `schema:url`: only the
  broadest dataset declares the prefix, so that lookups resolve to it rather than to an arbitrary subset. A dataset
  that holds terms in more than one URI space declares `schema:url` once per prefix, for example the Rights thesaurus,
  which reuses the canonical Creative Commons and RightsStatements.org URIs alongside its own;
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

### Writing the SPARQL queries

Search and lookup queries are SPARQL `CONSTRUCT` queries that the Network of Terms executes against the source’s endpoint. At runtime the placeholders are substituted with the request’s input:

- `?query` – the search string, lowercased and trimmed (the default `OPTIMIZED` query mode).
- `?virtuosoQuery` – the same string with each token quoted and joined by `AND`, ready for Virtuoso’s `bif:contains`.
- `?uris` in lookup queries – replaced by `VALUES ?uri { … }` with the URIs being looked up.
- `?datasetUri` in search queries – bound to the IRI of the dataset being searched.

#### Attributing terms to the right dataset

Several datasets may share a terms URI prefix (`schema:url`), for example when one thesaurus is published as multiple
sub-datasets. A URI lookup can then only be routed by prefix to one of them, so **lookup queries should construct
`?uri skos:inScheme ?datasetUri`** with `?datasetUri` bound to the IRI of the dataset that the term belongs to – either
from the source’s own `skos:inScheme` statements, or from a `VALUES` clause that maps the term’s type to a dataset IRI.
The Network of Terms uses that triple to attribute the term to its own dataset instead of the one the prefix pointed at.

#### Terms that denote a place

A query whose terms denote places should type them `schema:Place` and construct what SKOS cannot
state. The term’s position in the place hierarchy is not part of that: it stays on `skos:broader`
and `skos:narrower`, so a place is never also stated with `schema:containedInPlace`.

```sparql
?uri a skos:Concept , schema:Place ;
    schema:name ?name ;
    schema:additionalType ?featureCode ;
    schema:geo ?geo .
?geo a schema:GeoCoordinates ;
    schema:latitude ?latitude ;
    schema:longitude ?longitude ;
    schema:addressCountry ?countryCode .
```

- `schema:name` is the place’s own name, language-tagged, and nothing else. Where a source
  disambiguates homonyms by appending to the label – GeoNames’ `Bergen (NL)` – that suffix belongs
  on `skos:prefLabel` and not here, and the country it disambiguates by belongs in
  `schema:addressCountry`.
- The coordinates and the country hang off a `schema:geo` node, because `schema:addressCountry`
  does not have `schema:Place` in its domain. `schema:GeoCoordinates` is the only class that takes
  all three, and it is also where `schema:elevation` would go.
- **Mint the `schema:geo` node as an IRI derived from the term’s, not as a blank node.** A blank
  node in a `CONSTRUCT` template is minted once per solution row, and a term with many labels and
  parents carries hundreds of them. `BIND(IRI(CONCAT(STR(?uri), "#geo")) AS ?geo)` gives one node
  per term. The Network of Terms reads the coordinates through it and never returns the IRI.
- `schema:additionalType` is what kind of place this is, in the source’s own vocabulary – a
  GeoNames feature code, a Wikidata class. Construct the **URI**, not a label: the Network of Terms
  harmonises no vocabulary here, and a client either recognises it or joins to it itself. If the
  source also publishes a `skos:prefLabel` for that URI, construct it as well and the API returns
  it alongside; the label is read the same way a `skos:broader` term’s label is.
- Stating the coordinates flat on the term is still read as-is, for sources that predate the node.
  Each property falls back separately, so a source may add a `schema:geo` node for the country
  alone and leave its coordinates where they are.

#### Full-text search

Plain `FILTER(CONTAINS(…))` scans every candidate literal on each request. **Prefer the endpoint’s native full-text index** so the federated query stays fast. Common patterns:

- **Apache Jena Fuseki** – [`text:query`](https://jena.apache.org/documentation/query/text-query.html), e.g. `(?uri ?score) text:query (<field> ?query 100)`.
- **GraphDB (Lucene plugin)** – `?uri luc:term ?query` for labels and IDs, `?uri luc:text ?query` to also include scope notes. See [full-text search](https://graphdb.ontotext.com/documentation/10.8/full-text-search.html).
- **GraphDB (Lucene connector)** – named indexes via `luc:query` / `luc:entities`; list configured connectors with `?cntUri luc:listConnectors ?cntStr`.
- **GraphDB (Elasticsearch connector)** – same pattern under the `elastic:` namespace.
- **OpenLink Virtuoso** – [`bif:contains`](https://docs.openlinksw.com/virtuoso/bifcontainsoptions/), e.g. `?label bif:contains ?virtuosoQuery`.
- **Wikidata** – the `wikibase:mwapi` service with `mwapi:search` (titles) or `mwapi:srsearch` (full text). See the [Wikidata MWAPI manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual/MWAPI).

