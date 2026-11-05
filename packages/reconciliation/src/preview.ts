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
import { entityNames, occupationNames } from './entity-names.js';
import { isPerson } from './types.js';
import { schemaGender } from './properties.js';
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
    return `<html lang="${language}">
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
        ${isPerson(term) ? personFacts(term, locale, language) : conceptFacts(term, locale, language)}
        <dt>${locale.source}</dt>
        <dd>${source.name[language]} (${
          source.creators[0]?.alternateName[language] ??
          source.creators[0]?.alternateName['']
        })</dd>
      </dl>
      <p><a target="_blank" href="${escapeHtml(
        viewUrl(viewUrlTemplate, term.id.value),
      )}">${locale.view}</a></p>
  </body>
  </html>`;
  } else {
    return locale.notFound;
  }
}

// A concept’s place in its hierarchy and the terms related to it.
const conceptFacts = (term: Term, locale: locale, language: string) =>
  [
    hierarchy(term, locale, language),
    relatedTerms(locale.related, term.relatedTerms, language),
  ].join('');

// Sources may place persons in a hierarchy too, such as under a family or a guild.
const hierarchy = (term: Term, locale: locale, language: string) =>
  [
    relatedTerms(locale.broader, term.broaderTerms, language),
    relatedTerms(locale.narrower, term.narrowerTerms, language),
  ].join('');

// What tells a person apart from namesakes: their life, work and family. Sources that state family
// members state them as related terms too, so a term is related only when it is not family.
const personFacts = (term: Term, locale: locale, language: string) => {
  const person = term.person;
  const family = [
    ...(person?.parents ?? []),
    ...(person?.spouses ?? []),
    ...(person?.children ?? []),
    ...(person?.siblings ?? []),
  ];

  return [
    lifeEvent(
      locale.birth,
      person?.birthDates ?? [],
      person?.birthPlaces ?? [],
      language,
    ),
    lifeEvent(
      locale.death,
      person?.deathDates ?? [],
      person?.deathPlaces ?? [],
      language,
    ),
    fact(
      locale.occupation,
      occupationNames(person?.occupations ?? [], language),
    ),
    fact(locale.gender, genderNames(person?.genders ?? [], locale, language)),
    fact(
      locale.nationality,
      entityNames(person?.nationalities ?? [], language),
    ),
    relatedTerms(locale.parents, person?.parents ?? [], language),
    relatedTerms(locale.spouses, person?.spouses ?? [], language),
    relatedTerms(locale.children, person?.children ?? [], language),
    relatedTerms(locale.siblings, person?.siblings ?? [], language),
    hierarchy(term, locale, language),
    relatedTerms(
      locale.related,
      term.relatedTerms.filter(
        (related) => !family.some((member) => member.id.equals(related.id)),
      ),
      language,
    ),
  ].join('');
};

// Male and female, whether the source states them as Schema.org IRIs or as literals such as ‘v’,
// are named in the client’s language. Any other gender is named as the source names it.
const genderNames = (genders: Entity[], locale: locale, language: string) => {
  const known = genders.map((gender) =>
    [gender.iri?.value, ...gender.names.map(({ value }) => value)]
      .map(schemaGender)
      .find((schemaGender) => schemaGender !== undefined),
  );

  return [
    ...new Set([
      ...known
        .filter((gender) => gender !== undefined)
        .map((gender) => locale.genders[gender]),
      ...entityNames(
        genders.filter((_gender, index) => known[index] === undefined),
        language,
      ),
    ]),
  ];
};

function fact(label: string, values: string[]) {
  if (values.length === 0) {
    return '';
  }

  return `<dt>${label}</dt>
      <dd>${escapeHtml(values.join(' • '))}</dd>`;
}

const literal = (values: Literal[], language: string) =>
  literalValues(values, [language]).join(' • ');

// As in URI Templates (RFC 6570), {uri} is replaced with the percent-encoded IRI, which suits a
// query parameter, and {+uri} with the IRI as it is, which suits a link to the term itself.
const viewUrl = (template: string, iri: string) =>
  template.replace(/\{(\+?)uri\}/g, (_placeholder, asIs: string) =>
    asIs === '+' ? iri : encodeURIComponent(iri),
  );

// What the source states about the birth or death of the person a term denotes: the dates, then
// the places. Empty for any other term.
function lifeEvent(
  label: string,
  dates: string[],
  places: Entity[],
  language: string,
) {
  return fact(label, [...dates, ...entityNames(places, language)]);
}

function relatedTerms(label: string, terms: RelatedTerm[], language: string) {
  // Select the label per term, so each term gets its own language fallback.
  const prefLabels = terms
    .map((term) => literalValues(term.prefLabels, [language])[0])
    .filter((prefLabel) => prefLabel !== undefined);

  return fact(label, prefLabels);
}
