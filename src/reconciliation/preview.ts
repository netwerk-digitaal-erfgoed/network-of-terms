import {LookupQueryResult} from '../lookup/lookup';
import {RelatedTerm, Term} from '../services/terms';
import {Literal} from 'rdf-js';
import {escapeHtml} from '@hapi/hoek';

export function preview(lookupResult: LookupQueryResult) {
  const term = lookupResult.result;
  if (term instanceof Term) {
    return `<html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
        dt { font-weight: bold; margin-top: 1em; }
        dd { margin: 0; }
      </style>
    </head>
    <body>
      <h1>${literal(term.prefLabels)}</h1>
      <p>${literal(term.scopeNotes)}</p>
      <dl>
        ${
          term.altLabels.length > 0
            ? `<dt>Alternatieve labels</dt><dd>${literal(term.altLabels)}</dd>`
            : ''
        }
        ${relatedTerms('Bredere termen', term.broaderTerms)}
        ${relatedTerms('Nauwere termen', term.narrowerTerms)}
        ${relatedTerms('Gerelateerde termen', term.relatedTerms)}
      </dl>
  </body>
  </html>`;
  } else {
    return 'Niet gevonden';
  }
}

const literal = (values: Literal[]) =>
  values.map(literal => literal.value).join(' • ');

function relatedTerms(label: string, terms: RelatedTerm[]) {
  if (terms.length === 0) {
    return '';
  }

  return `<dt>${label}</dt>
      <dd>${escapeHtml(
        terms.map(term => term.prefLabels[0].value).join(' • ')
      )}</dd>`;
}
