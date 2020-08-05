import * as RDF from 'rdf-js';

export class Term {
  id: RDF.Term | undefined = undefined;
  type: RDF.Term | undefined = undefined;
  prefLabels: RDF.Term[] = [];
  altLabels: RDF.Term[] = [];
  hiddenLabels: RDF.Term[] = [];
  scopeNotes: RDF.Term[] = [];
  broaderLabels: RDF.Term[] = [];
  narrowerLabels: RDF.Term[] = [];
}

export class TermsTransformer {
  protected terms: Term[] = [];
  protected currentTerm: Term = new Term();
  protected readonly predicateToPropertyMap = new Map<string, string>([
    ['http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'type'],
    ['http://www.w3.org/2004/02/skos/core#prefLabel', 'prefLabels'],
    ['http://www.w3.org/2008/05/skos#prefLabel', 'prefLabels'],
    ['http://www.w3.org/2004/02/skos/core#altLabel', 'altLabels'],
    ['http://www.w3.org/2008/05/skos#altLabel', 'altLabels'],
    ['http://www.w3.org/2004/02/skos/core#hiddenLabel', 'hiddenLabels'],
    ['http://www.w3.org/2008/05/skos#hiddenLabel', 'hiddenLabels'],
    ['http://www.w3.org/2004/02/skos/core#scopeNote', 'scopeNotes'],
    ['http://www.w3.org/2008/05/skos#scopeNote', 'scopeNotes'],
    ['http://www.w3.org/2004/02/skos/core#broader', 'broaderLabels'],
    ['http://www.w3.org/2008/05/skos#broader', 'broaderLabels'],
    ['http://www.w3.org/2004/02/skos/core#narrower', 'narrowerLabels'],
    ['http://www.w3.org/2008/05/skos#narrower', 'narrowerLabels'],
  ]);

  fromQuad(quad: RDF.Quad): void {
    const subject = quad.subject;
    if (!subject.equals(this.currentTerm.id)) {
      if (this.currentTerm.id !== undefined) {
        this.terms.push(this.currentTerm);
      }
      this.currentTerm = new Term();
      this.currentTerm.id = subject;
    }
    const predicate = quad.predicate.value;
    const propertyName = this.predicateToPropertyMap.get(predicate);
    if (propertyName !== undefined) {
      const propertyValue = (this.currentTerm as any)[propertyName]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (Array.isArray(propertyValue)) {
        propertyValue.push(quad.object);
      } else {
        (this.currentTerm as any)[propertyName] = quad.object; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }
  }

  asArray(): Term[] {
    return this.terms;
  }
}
