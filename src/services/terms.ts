import * as RDF from 'rdf-js';

export class Term {
  constructor(
    readonly id: RDF.Term,
    readonly type: RDF.Term | undefined,
    readonly prefLabels: RDF.Term[],
    readonly altLabels: RDF.Term[],
    readonly hiddenLabels: RDF.Term[],
    readonly scopeNotes: RDF.Term[],
    readonly broaderTerms: RelatedTerm[],
    readonly narrowerTerms: RelatedTerm[],
    readonly relatedTerms: RelatedTerm[]
  ) {}
}

export class RelatedTerm {
  constructor(readonly id: RDF.Term, readonly prefLabels: RDF.Term[]) {}
}

class SparqlResultTerm {
  constructor(readonly id: RDF.Term) {}
  type: RDF.Term | undefined = undefined;
  prefLabels: RDF.Term[] = [];
  altLabels: RDF.Term[] = [];
  hiddenLabels: RDF.Term[] = [];
  scopeNotes: RDF.Term[] = [];
  broaderTerms: RDF.Term[] = [];
  narrowerTerms: RDF.Term[] = [];
  relatedTerms: RDF.Term[] = [];
}

export class TermsTransformer {
  private termsIris: string[] = [];
  private termsMap: Map<string, SparqlResultTerm> = new Map();
  private readonly predicateToPropertyMap = new Map<string, string>([
    ['http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'type'],
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
      quad.object.value === 'http://www.w3.org/2004/02/skos/core#Concept'
    ) {
      this.termsIris.push(subject.value);
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
    return this.termsIris.map(iri => {
      const term = this.termsMap.get(iri)!;

      return new Term(
        term.id,
        term.type,
        term.prefLabels,
        term.altLabels,
        term.hiddenLabels,
        term.scopeNotes,
        term.broaderTerms.map(
          iri => this.termsMap.get(iri.value) as RelatedTerm
        ),
        term.narrowerTerms.map(
          iri => this.termsMap.get(iri.value) as RelatedTerm
        ),
        term.relatedTerms.map(
          iri => this.termsMap.get(iri.value) as RelatedTerm
        )
      );
    });
  }
}
