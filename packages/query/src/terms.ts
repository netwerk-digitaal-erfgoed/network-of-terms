import type RDF from '@rdfjs/types';

export class Term {
  constructor(
    readonly id: RDF.Term,
    readonly types: RDF.Term[],
    readonly prefLabels: RDF.Literal[],
    readonly altLabels: RDF.Literal[],
    readonly hiddenLabels: RDF.Literal[],
    readonly scopeNotes: RDF.Literal[],
    readonly seeAlso: RDF.NamedNode[],
    readonly broaderTerms: RelatedTerm[],
    readonly narrowerTerms: RelatedTerm[],
    readonly relatedTerms: RelatedTerm[],
    readonly exactMatches: RelatedTerm[],
    readonly datasetIri: RDF.Term | undefined,
    readonly score: RDF.Literal | undefined,
    readonly latitude: RDF.Literal | undefined,
    readonly longitude: RDF.Literal | undefined,
    // Defaulted, so that adding to a place stays additive for callers that construct a Term.
    readonly names: RDF.Literal[] = [],
    readonly addressCountry: RDF.Literal | undefined = undefined,
    readonly additionalTypes: RelatedTerm[] = [],
  ) {}
}

export class RelatedTerm {
  constructor(
    readonly id: RDF.Term,
    readonly prefLabels: RDF.Literal[],
  ) {}
}

class SparqlResultTerm {
  constructor(readonly id: RDF.Term) {}
  types: RDF.Term[] = [];
  prefLabels: RDF.Literal[] = [];
  altLabels: RDF.Literal[] = [];
  hiddenLabels: RDF.Literal[] = [];
  scopeNotes: RDF.Literal[] = [];
  seeAlso: RDF.NamedNode[] = [];
  broaderTerms: RDF.Term[] = [];
  narrowerTerms: RDF.Term[] = [];
  relatedTerms: RDF.Term[] = [];
  exactMatches: RDF.Term[] = [];
  inScheme: RDF.Term | undefined = undefined;
  score: RDF.Literal | undefined = undefined;
  latitude: RDF.Literal | undefined = undefined;
  longitude: RDF.Literal | undefined = undefined;
  names: RDF.Literal[] = [];
  geo: RDF.Term | undefined = undefined;
  addressCountry: RDF.Literal | undefined = undefined;
  additionalTypes: RDF.Term[] = [];
}

export class TermsTransformer {
  private termsIris: Set<string> = new Set();
  private termsMap: Map<string, SparqlResultTerm> = new Map();
  private readonly predicateToPropertyMap = new Map<string, string>([
    ['http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'types'],
    ['http://www.w3.org/2000/01/rdf-schema#seeAlso', 'seeAlso'],
    ['http://www.w3.org/2004/02/skos/core#prefLabel', 'prefLabels'],
    ['http://www.w3.org/2008/05/skos#prefLabel', 'prefLabels'],
    ['http://www.w3.org/2004/02/skos/core#altLabel', 'altLabels'],
    ['http://www.w3.org/2008/05/skos#altLabel', 'altLabels'],
    ['http://www.w3.org/2004/02/skos/core#hiddenLabel', 'hiddenLabels'],
    ['http://www.w3.org/2008/05/skos#hiddenLabel', 'hiddenLabels'],
    ['http://www.w3.org/2004/02/skos/core#scopeNote', 'scopeNotes'],
    ['http://www.w3.org/2008/05/skos#scopeNote', 'scopeNotes'],
    ['http://www.w3.org/2004/02/skos/core#broader', 'broaderTerms'],
    ['http://www.w3.org/2008/05/skos#broader', 'broaderTerms'],
    ['http://www.w3.org/2004/02/skos/core#narrower', 'narrowerTerms'],
    ['http://www.w3.org/2008/05/skos#narrower', 'narrowerTerms'],
    ['http://www.w3.org/2004/02/skos/core#related', 'relatedTerms'],
    ['http://www.w3.org/2008/05/skos#related', 'relatedTerms'],
    ['http://www.w3.org/2004/02/skos/core#exactMatch', 'exactMatches'],
    ['http://www.w3.org/2008/05/skos#exactMatch', 'exactMatches'],
    ['http://www.w3.org/2004/02/skos/core#inScheme', 'inScheme'],
    ['http://purl.org/voc/vrank#simpleRank', 'score'],
    // Both Schema.org namespaces, because source queries use either one.
    ['https://schema.org/name', 'names'],
    ['http://schema.org/name', 'names'],
    ['https://schema.org/geo', 'geo'],
    ['http://schema.org/geo', 'geo'],
    ['https://schema.org/latitude', 'latitude'],
    ['http://schema.org/latitude', 'latitude'],
    ['https://schema.org/longitude', 'longitude'],
    ['http://schema.org/longitude', 'longitude'],
    ['https://schema.org/addressCountry', 'addressCountry'],
    ['http://schema.org/addressCountry', 'addressCountry'],
    ['https://schema.org/additionalType', 'additionalTypes'],
    ['http://schema.org/additionalType', 'additionalTypes'],
  ]);

  fromQuad(quad: RDF.Quad): void {
    const subject = quad.subject;
    const propertyName = this.predicateToPropertyMap.get(quad.predicate.value);
    const currentTerm =
      this.termsMap.get(subject.value) ?? new SparqlResultTerm(subject);
    this.termsMap.set(subject.value, currentTerm);

    // skos:Concepts are the top-level search results, which we track in termsIris.
    if (
      propertyName === 'types' &&
      (quad.object.value === 'http://www.w3.org/2004/02/skos/core#Concept' ||
        quad.object.value === 'http://www.w3.org/2008/05/skos#Concept')
    ) {
      this.termsIris.add(subject.value);
    }

    if (propertyName !== undefined) {
      const propertyValue = (currentTerm as any)[propertyName]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (Array.isArray(propertyValue)) {
        // Prevent duplicate prefLabel values due to duplicate quads.
        if (!propertyValue.find((value) => value.equals(quad.object))) {
          propertyValue.push(quad.object);
        }
      } else {
        (currentTerm as any)[propertyName] = quad.object; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }
  }

  asArray(): Term[] {
    return [...this.termsIris].map((iri) => {
      const term = this.termsMap.get(iri)!;
      const location = this.location(term);

      return new Term(
        term.id,
        term.types,
        term.prefLabels,
        term.altLabels,
        term.hiddenLabels,
        term.scopeNotes,
        term.seeAlso,
        this.mapRelatedTerms(term.broaderTerms).sort(alphabeticallyByPrefLabel),
        this.mapRelatedTerms(term.narrowerTerms).sort(
          alphabeticallyByPrefLabel,
        ),
        this.mapRelatedTerms(term.relatedTerms).sort(alphabeticallyByPrefLabel),
        this.mapRelatedTerms(term.exactMatches).sort(alphabeticallyByPrefLabel),
        term.inScheme,
        term.score,
        location.latitude,
        location.longitude,
        term.names,
        location.addressCountry,
        term.additionalTypes.map(this.namedType).sort(alphabeticallyByPrefLabel),
      );
    });
  }

  /**
   * Where the term is, read from the `schema:geo` node it points at and from the term itself.
   *
   * Sources hang the coordinates and the country off a `schema:geo` node, because
   * `schema:addressCountry` does not have `schema:Place` in its domain and would be an
   * unsanctioned triple on the term itself. That costs this transformer its only traversal;
   * everything else stays a flat predicate→property map.
   *
   * Each property falls back to the term separately, so a source that states its coordinates flat
   * and adds a `schema:geo` node only to carry the country – the natural way to migrate, since the
   * country is the one property that cannot stay flat – keeps both.
   */
  private location = (term: SparqlResultTerm) => {
    const geo =
      term.geo === undefined ? undefined : this.termsMap.get(term.geo.value);

    return {
      latitude: geo?.latitude ?? term.latitude,
      longitude: geo?.longitude ?? term.longitude,
      addressCountry: geo?.addressCountry ?? term.addressCountry,
    };
  };

  /**
   * An IRI from a vocabulary outside this source, with whatever names the source gave it.
   *
   * A vocabulary names its own classes as it sees fit – the GeoNames ontology uses
   * `skos:prefLabel`, others `schema:name` – and a source cannot be asked to translate between
   * them, so both are read. Most vocabularies are published without any name at all, and then the
   * IRI is all a client gets.
   */
  private namedType = (iri: RDF.Term) => {
    const type = this.termsMap.get(iri.value);
    const names = [...(type?.prefLabels ?? []), ...(type?.names ?? [])];

    return new RelatedTerm(
      iri,
      names.filter(
        (name, index) =>
          names.findIndex((other) => other.equals(name)) === index,
      ),
    );
  };

  /**
   * Map related IRIs to their related terms, making sure to only accept complete related terms.
   *
   * Related terms can be incomplete because of the SPARQL query limit (see
   * https://github.com/netwerk-digitaal-erfgoed/network-of-terms/issues/36).
   */
  private mapRelatedTerms = (terms: RDF.Term[]) =>
    terms.reduce((acc: RelatedTerm[], iri: RDF.Term) => {
      const term = this.termsMap.get(iri.value);
      acc.push(new RelatedTerm(iri, term?.prefLabels ?? []));
      return acc;
    }, []);
}

const alphabeticallyByPrefLabel = (a: RelatedTerm, b: RelatedTerm) => {
  const prefLabelA = a.prefLabels[0]?.value ?? '';
  const prefLabelB = b.prefLabels[0]?.value ?? '';
  return prefLabelA.localeCompare(prefLabelB);
};
