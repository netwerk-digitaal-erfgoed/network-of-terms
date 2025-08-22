import {
  Dataset,
  literalValues,
  LookupQueryResult,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {Literal} from '@rdfjs/types';
import {escapeHtml} from '@hapi/hoek';
import {locale} from './server.js';

export function preview(
  lookupResult: LookupQueryResult,
  source: Dataset,
  locale: locale,
  language: string
) {
  const term = lookupResult.result;
  if (term instanceof Term) {
    return `<html :lang="language">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
        dt { font-weight: bold; margin-top: 1em; }
        dd { margin: 0; }
      </style>
    </head>
    <body>
      <h1>${literal(term.prefLabels, language)}</h1>
      <p>${literal(term.scopeNotes, language)}</p>
      <dl>
        ${
          term.altLabels.length > 0
            ? `<dt>${locale.altLabels}</dt><dd>${literal(term.altLabels, language)}</dd>`
            : ''
        }
        ${relatedTerms(locale.broader, term.broaderTerms, language)}
        ${relatedTerms(locale.narrower, term.narrowerTerms, language)}
        ${relatedTerms(locale.related, term.relatedTerms, language)}
        <dt>${locale.source}</dt>
        <dd>${source.name[language]} (${source.creators[0]?.alternateName[language] ?? source.creators[0]?.alternateName['']})</dd>
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

const literal = (values: Literal[], language: string) =>
  literalValues(values, [language]).join(' • ');

function relatedTerms(label: string, terms: RelatedTerm[], language: string) {
  const termsWithPrefLabel = terms.filter(term => term.prefLabels.length > 0);
  if (termsWithPrefLabel.length === 0) {
    return '';
  }

  return `<dt>${label}</dt>
      <dd>${escapeHtml(
        literal(
          termsWithPrefLabel.map(term => term.prefLabels[0]),
          language
        )
      )}</dd>`;
}
