import * as RDF from '@rdfjs/types';

export class Term {
  constructor(
    readonly id: RDF.Term,
    readonly type: RDF.Term | undefined,
    readonly prefLabels: RDF.Literal[],
    readonly altLabels: RDF.Literal[],
    readonly hiddenLabels: RDF.Literal[],
    readonly scopeNotes: RDF.Literal[],
    readonly seeAlso: RDF.NamedNode[],
    readonly broaderTerms: RelatedTerm[],
    readonly narrowerTerms: RelatedTerm[],
    readonly relatedTerms: RelatedTerm[],
    readonly datasetIri: RDF.Term | undefined,
    readonly score: RDF.Literal | undefined
  ) {}
}

export class RelatedTerm {
  constructor(
    readonly id: RDF.Term,
    readonly prefLabels: RDF.Literal[]
  ) {}
}

class SparqlResultTerm {
  constructor(readonly id: RDF.Term) {}
  type: RDF.Term | undefined = undefined;
  prefLabels: RDF.Literal[] = [];
  altLabels: RDF.Literal[] = [];
  hiddenLabels: RDF.Literal[] = [];
  scopeNotes: RDF.Literal[] = [];
  seeAlso: RDF.NamedNode[] = [];
  broaderTerms: RDF.Term[] = [];
  narrowerTerms: RDF.Term[] = [];
  relatedTerms: RDF.Term[] = [];
  inScheme: RDF.Term | undefined = undefined;
  score: RDF.Literal | undefined = undefined;
}

export class TermsTransformer {
  private termsIris: Set<string> = new Set();
  private termsMap: Map<string, SparqlResultTerm> = new Map();
  private readonly predicateToPropertyMap = new Map<string, string>([
    ['http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'type'],
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
    ['http://www.w3.org/2004/02/skos/core#inScheme', 'inScheme'],
    ['http://purl.org/voc/vrank#simpleRank', 'score'],
  ]);

  fromQuad(quad: RDF.Quad): void {
    const subject = quad.subject;
    const propertyName = this.predicateToPropertyMap.get(quad.predicate.value);
    const currentTerm =
      this.termsMap.get(subject.value) ?? new SparqlResultTerm(subject);
    this.termsMap.set(subject.value, currentTerm);

    // skos:Concepts are the top-level search results, which we track in termsIris.
    if (
      propertyName === 'type' &&
      (quad.object.value === 'http://www.w3.org/2004/02/skos/core#Concept' ||
        quad.object.value === 'http://www.w3.org/2008/05/skos#Concept')
    ) {
      this.termsIris.add(subject.value);
    }

    if (propertyName !== undefined) {
      const propertyValue = (currentTerm as any)[propertyName]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (Array.isArray(propertyValue)) {
        // Prevent duplicate prefLabel values due to duplicate quads.
        if (!propertyValue.find(value => value.equals(quad.object))) {
          propertyValue.push(quad.object);
        }
      } else {
        (currentTerm as any)[propertyName] = quad.object; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }
  }

  asArray(): Term[] {
    return [...this.termsIris].map(iri => {
      const term = this.termsMap.get(iri)!;

      return new Term(
        term.id,
        term.type,
        term.prefLabels,
        term.altLabels,
        term.hiddenLabels,
        term.scopeNotes,
        term.seeAlso,
        this.mapRelatedTerms(term.broaderTerms).sort(alphabeticallyByPrefLabel),
        this.mapRelatedTerms(term.narrowerTerms).sort(
          alphabeticallyByPrefLabel
        ),
        this.mapRelatedTerms(term.relatedTerms).sort(alphabeticallyByPrefLabel),
        term.inScheme,
        term.score
      );
    });
  }

  /**
   * Map related IRIs to their related terms, making sure to only accept complete related terms.
   *
   * Related terms can be incomplete because of the SPARQL query limit (see
   * https://github.com/netwerk-digitaal-erfgoed/network-of-terms/issues/36).
   */
  private mapRelatedTerms = (terms: RDF.Term[]) =>
    terms.reduce((acc: RelatedTerm[], iri: RDF.Term) => {
      const term = this.termsMap.get(iri.value);
      if (term) {
        acc.push(new RelatedTerm(term.id, term.prefLabels));
      }
      return acc;
    }, []);
}

const alphabeticallyByPrefLabel = (a: RelatedTerm, b: RelatedTerm) => {
  const prefLabelA = a.prefLabels[0]?.value ?? '';
  const prefLabelB = b.prefLabels[0]?.value ?? '';
  return prefLabelA.localeCompare(prefLabelB);
};
