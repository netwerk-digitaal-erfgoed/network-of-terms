import * as RDF from 'rdf-js';

export class Term {
  id: RDF.Term;
  type: RDF.Term;
  prefLabels: RDF.Term[] = [];
  altLabels: RDF.Term[] = [];
  hiddenLabels: RDF.Term[] = [];
  scopeNotes: RDF.Term[] = [];
  broaderLabels: RDF.Term[] = [];
  narrowerLabels: RDF.Term[] = [];
}
