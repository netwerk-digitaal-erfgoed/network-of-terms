import {
  Dataset,
  Entity,
  literalValues,
  LookupQueryResult,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { Literal } from '@rdfjs/types';
import { escapeHtml } from '@hapi/hoek';
import { placeNames } from './place-names.js';
import { locale } from './server.js';

export function preview(
  lookupResult: LookupQueryResult,
  source: Dataset,
  locale: locale,
  language: string,
  viewUrlTemplate: string,
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
            ? `<dt>${locale.altLabels}</dt><dd>${literal(
                term.altLabels,
                language,
              )}</dd>`
            : ''
        }
        ${lifeEvent(locale.birth, term.birthDates, term.birthPlaces, language)}
        ${lifeEvent(locale.death, term.deathDates, term.deathPlaces, language)}
        ${relatedTerms(locale.broader, term.broaderTerms, language)}
        ${relatedTerms(locale.narrower, term.narrowerTerms, language)}
        ${relatedTerms(locale.related, term.relatedTerms, language)}
        <dt>${locale.source}</dt>
        <dd>${source.name[language]} (${
          source.creators[0]?.alternateName[language] ??
          source.creators[0]?.alternateName['']
        })</dd>
      </dl>
      </p><a target="_blank" href="${viewUrlTemplate.replace(
        '{uri}',
        term.id.value,
      )}">${locale.view}</a>
  </body>
  </html>`;
  } else {
    return locale.notFound;
  }
}

const literal = (values: Literal[], language: string) =>
  literalValues(values, [language]).join(' • ');

// What the source states about the birth or death of the person a term denotes: the dates, then
// the places. Empty for any other term.
function lifeEvent(
  label: string,
  dates: Literal[],
  places: Entity[],
  language: string,
) {
  const facts = [
    ...dates.map((date) => date.value),
    ...placeNames(places, language),
  ];
  if (facts.length === 0) {
    return '';
  }

  return `<dt>${label}</dt>
      <dd>${escapeHtml(facts.join(' • '))}</dd>`;
}

function relatedTerms(label: string, terms: RelatedTerm[], language: string) {
  // Select the label per term, so each term gets its own language fallback.
  const prefLabels = terms
    .map((term) => literalValues(term.prefLabels, [language])[0])
    .filter((prefLabel) => prefLabel !== undefined);
  if (prefLabels.length === 0) {
    return '';
  }

  return `<dt>${label}</dt>
      <dd>${escapeHtml(prefLabels.join(' • '))}</dd>`;
}
