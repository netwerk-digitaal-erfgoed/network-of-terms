import {
  Dataset,
  LookupQueryResult,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {Literal} from '@rdfjs/types';
import {escapeHtml} from '@hapi/hoek';
import {locale} from './server';

export function preview(
  lookupResult: LookupQueryResult,
  source: Dataset,
  locale: locale
) {
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
            ? `<dt>${locale.altLabels}</dt><dd>${literal(term.altLabels)}</dd>`
            : ''
        }
        ${relatedTerms(locale.broader, term.broaderTerms)}
        ${relatedTerms(locale.narrower, term.narrowerTerms)}
        ${relatedTerms(locale.related, term.relatedTerms)}
        <dt>${locale.source}</dt>
        <dd>${source.name} (${source.creators[0]?.alternateName})</dd>
      </dl>
      </p><a target="_blank" href="https://termennetwerk.netwerkdigitaalerfgoed.nl/lookup?uri=${
        term.id.value
      }">${locale.view}</a>
  </body>
  </html>`;
  } else {
    return locale.notFound;
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
