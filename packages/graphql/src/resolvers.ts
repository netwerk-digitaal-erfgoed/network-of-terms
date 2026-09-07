import {
  filterLiteralsByLanguage,
  literalValues,
  Catalog,
  Dataset,
  Distribution,
  DistributionsService,
  Error,
  Feature,
  FeatureType,
  LookupQueryResult,
  LookupResult,
  LookupService,
  NotFoundError,
  QueryMode,
  QueryTermsService,
  Referents,
  OccupationRole,
  ServerError,
  SourceNotFoundError,
  SourceResult,
  Term,
  TermsResponse,
  TermsResult,
  TimeoutError,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import * as RDF from '@rdfjs/types';
import { dereferenceGenre } from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import type { StatusClient } from './status.js';
import { config } from './config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listSources(object: any, args: any, context: any): Promise<any> {
  return context.catalog
    .getDatasetsSortedByName(context.catalogLanguage)
    .filter(
      (dataset: Dataset) =>
        !args.genres ||
        dataset.genres.some((genre: string) => args.genres.includes(genre)),
    )
    .flatMap((dataset: Dataset) =>
      dataset.distributions.map((distribution: Distribution) =>
        source(
          distribution,
          dataset,
          context.catalogLanguage,
          context.statusClient,
        ),
      ),
    );
}

async function queryTerms(
  _: unknown,
  args: {
    sources: string[];
    genres?: string[];
    query: string;
    queryMode: string;
    limit: number;
    timeoutMs: number;
    languages: string[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
): Promise<unknown> {
  const service = new DistributionsService({
    logger: context.app.log,
    catalog: context.catalog,
    comunica: context.comunica,
  });
  const results = await service.queryAll({
    sources: args.sources,
    genres: args.genres,
    query: args.query,
    queryMode: QueryMode[args.queryMode as keyof typeof QueryMode],
    limit: args.limit,
    timeoutMs: args.timeoutMs,
  });
  return resolveTermsResponse(
    results,
    context.catalog,
    [...(args.languages ?? []), context.catalogLanguage][0],
    args.languages,
    context.statusClient,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lookupTerms(object: any, args: any, context: any) {
  // A lookup is split into batches sized to what each source will take, so there is no limit here
  // that a caller should ever meet. This one is a safety valve: a thousand URIs is already minutes
  // of work at the slowest source, and nothing else stops one request occupying it for longer.
  if (args.uris.length > config.MAX_LOOKUP_URIS) {
    throw new globalThis.Error(
      `A lookup takes at most ${config.MAX_LOOKUP_URIS} URIs, got ${args.uris.length}.`,
    );
  }

  const service = new LookupService(
    context.catalog,
    new QueryTermsService({
      comunica: context.comunica,
      logger: context.app.log,
    }),
  );
  const results = await service.lookup(args.uris, args.timeoutMs);
  const catalogLanguage = [
    ...(args.languages ?? []),
    context.catalogLanguage,
  ][0];

  return results.map((result: LookupQueryResult) => {
    return {
      uri: result.uri,
      source:
        result.distribution instanceof SourceNotFoundError
          ? result.distribution
          : source(
              result.distribution,
              context.catalog.getDatasetByDistributionIri(
                result.distribution.iri,
              )!,
              catalogLanguage,
              context.statusClient,
            ),
      result:
        result.result instanceof Term
          ? args.languages === undefined
            ? mapToTerm(result.result, ['nl'])
            : mapToTranslatedTerm(result.result, args.languages)
          : result.result,
      responseTimeMs: result.responseTimeMs,
    };
  });
}

function resolveTermsResponse(
  results: TermsResponse[],
  catalog: Catalog,
  catalogLanguage: string,
  resultLanguages: string[],
  statusClient?: StatusClient,
) {
  return results.map((response: TermsResponse) => {
    if (response.result instanceof Error) {
      return {
        source: source(
          response.result.distribution,
          catalog.getDatasetByDistributionIri(
            response.result.distribution.iri,
          )!,
          catalogLanguage,
          statusClient,
        ),
        result: response.result,
        responseTimeMs: response.responseTimeMs,
        terms: [], // For BC.
      };
    }

    const terms = response.result.terms.map((term) =>
      mapToTerm(term, resultLanguages),
    );

    return {
      source: source(
        response.result.distribution,
        catalog.getDatasetByDistributionIri(response.result.distribution.iri)!,
        catalogLanguage,
        statusClient,
      ),
      result:
        resultLanguages === undefined
          ? { terms }
          : new TranslatedTerms(
              response.result.terms.map((term) =>
                mapToTranslatedTerm(term, resultLanguages),
              ),
            ),
      responseTimeMs: response.responseTimeMs,
      terms, // For BC.
    };
  });
}

class TranslatedTerms {
  constructor(readonly terms: object[]) {}
}

function mapToTranslatedTerm(term: Term, languages: string[]) {
  return {
    type: 'TranslatedTerm',
    uri: term.id!.value,
    prefLabel: filterLiteralsByLanguage(term.prefLabels, languages),
    altLabel: filterLiteralsByLanguage(term.altLabels, languages),
    hiddenLabel: filterLiteralsByLanguage(term.hiddenLabels, languages),
    definition: filterLiteralsByLanguage(term.scopeNotes, languages),
    scopeNote: filterLiteralsByLanguage(term.scopeNotes, languages),
    seeAlso: term.seeAlso.map((seeAlso: RDF.NamedNode) => seeAlso.value),
    broader: term.broaderTerms.map((related) => ({
      uri: related.id.value,
      prefLabel: filterLiteralsByLanguage(related.prefLabels, languages),
    })),
    narrower: term.narrowerTerms.map((related) => ({
      uri: related.id.value,
      prefLabel: filterLiteralsByLanguage(related.prefLabels, languages),
    })),
    related: term.relatedTerms.map((related) => ({
      uri: related.id.value,
      prefLabel: filterLiteralsByLanguage(related.prefLabels, languages),
    })),
    exactMatch: term.exactMatches.map((exactMatch) => ({
      uri: exactMatch.id.value,
      prefLabel: filterLiteralsByLanguage(exactMatch.prefLabels, languages),
    })),
    place: denotedPlace(term, (literals) =>
      filterLiteralsByLanguage(literals, languages),
    ),
    person: denotedPerson(
      term,
      (literals) => filterLiteralsByLanguage(literals, languages),
      (sets) =>
        sets.map((literals) => filterLiteralsByLanguage(literals, languages)),
    ),
  };
}

/**
 * The place that the term denotes, or null if its source describes none.
 *
 * The node carries only what SKOS cannot state, so the term’s position in the place hierarchy stays
 * on `broader` and `narrower` and is not repeated here. That leaves the coordinates, the country
 * and the place’s own name: a term typed as a place whose source publishes none of them has
 * nothing to put in the node, so it gets no node rather than an empty one that reads as a
 * described place.
 */
function denotedPlace(
  term: Term,
  inRequestedLanguages: (literals: RDF.Literal[]) => RDF.Literal[],
) {
  if (!term.types.some((type) => placeClasses.has(type.value))) {
    return null;
  }

  const latitude = floatValue(term.latitude);
  const longitude = floatValue(term.longitude);
  // An empty country is as unusable as an empty coordinate, and ISO 3166-1 has no empty code.
  const addressCountry = term.addressCountry?.value.trim() || null;

  // Tested against everything the source holds, not against what survives the language filter, so
  // whether the node exists is a fact about the term rather than about the requested language.
  return latitude === null &&
    longitude === null &&
    addressCountry === null &&
    term.names.length === 0 &&
    term.additionalTypes.length === 0
    ? null
    : {
        name: inRequestedLanguages(term.names),
        latitude,
        longitude,
        addressCountry,
        additionalType: term.additionalTypes.map((additionalType) => ({
          uri: additionalType.id.value,
          name: inRequestedLanguages(additionalType.prefLabels),
        })),
      };
}

// Both Schema.org namespaces, because source queries use either one.
const placeClasses = new Set([
  'https://schema.org/Place',
  'http://schema.org/Place',
]);

/**
 * The person that the term denotes, or null if its source describes none.
 *
 * As with {@link denotedPlace}, the node carries only what SKOS cannot state: full names stay on
 * the labels and alignments on `exactMatch`, so what is left is the split into given and family
 * name, the dates, places, occupations and nationality. A term typed as a person whose source
 * states none of them gets no node.
 *
 * A date is passed through as the source states it. Sources are not validated, and the field is
 * documented as EDTF, which reads a plain ISO 8601 date, an interval and a qualified date alike.
 * Where a source states several – Wikidata can, when its sources disagree – the first is taken.
 */
function denotedPerson(
  term: Term,
  inRequestedLanguages: (literals: RDF.Literal[]) => RDF.Literal[],
  acrossSet: (sets: RDF.Literal[][]) => RDF.Literal[][],
) {
  if (!term.types.some((type) => personClasses.has(type.value))) {
    return null;
  }

  const birthDate = dateValue(term.birthDates[0]);
  const deathDate = dateValue(term.deathDates[0]);

  // Tested against everything the source holds, not against what survives the language filter,
  // for the reason given in denotedPlace.
  const referents = referentsIn(inRequestedLanguages);
  const isEmpty = (referents: Referents) =>
    referents.terms.length === 0 && referents.names.length === 0;

  return term.givenNames.length === 0 &&
    term.familyNames.length === 0 &&
    birthDate === null &&
    deathDate === null &&
    isEmpty(term.birthPlaces) &&
    isEmpty(term.deathPlaces) &&
    term.occupations.length === 0 &&
    isEmpty(term.nationalities)
    ? null
    : {
        givenName: inRequestedLanguages(term.givenNames),
        familyName: inRequestedLanguages(term.familyNames),
        birthDate,
        deathDate,
        birthPlace: referents(term.birthPlaces),
        deathPlace: referents(term.deathPlaces),
        hasOccupation: rolesIn(acrossSet)(term.occupations),
        nationality: referents(term.nationalities),
      };
}

/**
 * Sources are not validated, so a date may be an empty string; that is no date, as an empty
 * country is no country in {@link denotedPlace}.
 */
const dateValue = (literal: RDF.Literal | undefined) =>
  literal?.value.trim() || null;

/**
 * A role is kept when its occupation or its name survives the language filter; a period alone
 * would say ‘did something from 1625 to 1669’. A source that only names its occupations states
 * one role per name, since nothing tells its Dutch and English names for one occupation apart
 * from its names for two, so once the names in the languages the client did not ask for are
 * gone, a role may have nothing left and is dropped rather than returned empty.
 */
const rolesIn =
  (acrossSet: (sets: RDF.Literal[][]) => RDF.Literal[][]) =>
  (roles: OccupationRole[]) => {
    // Every name list of every role goes through the language selection at once, so that a
    // fallback applies to the set and not to each role on its own.
    const names = acrossSet(
      roles.flatMap((role) => [role.occupation?.names ?? [], role.roleNames]),
    );
    return roles
      .map((role, index) => ({
        occupation:
          role.occupation === undefined
            ? null
            : {
                uri: role.occupation.iri.value,
                name: names[2 * index],
              },
        roleName: names[2 * index + 1],
        startDate: dateValue(role.startDate),
        endDate: dateValue(role.endDate),
      }))
      .filter((role) => role.occupation !== null || role.roleName.length > 0);
  };

/**
 * What the source refers to, and what it only names, as the API states them: the terms with their
 * names in the requested languages, as an exact match is labelled, and the names the source gave
 * as text, selected as one list.
 */
const referentsIn =
  (inRequestedLanguages: (literals: RDF.Literal[]) => RDF.Literal[]) =>
  (referents: Referents) => ({
    term: referents.terms.map((reference) => ({
      uri: reference.iri.value,
      name: inRequestedLanguages(reference.names),
    })),
    name: inRequestedLanguages(referents.names),
  });

const personClasses = new Set([
  'https://schema.org/Person',
  'http://schema.org/Person',
]);

/**
 * Sources are not validated, so a coordinate may be absent, empty or not a number at all. Anything
 * we cannot read as a finite number becomes null: an unknown coordinate is not a field error, and
 * `Number('')` would silently place the term at 0°, 0°.
 */
const floatValue = (literal: RDF.Literal | undefined) => {
  const value = Number(literal?.value);
  return Number.isFinite(value) && literal?.value.trim() !== '' ? value : null;
};

function mapToTerm(term: Term, languages: string[]) {
  return {
    uri: term.id!.value,
    prefLabel: literalValues(term.prefLabels, languages),
    altLabel: literalValues(term.altLabels, languages),
    hiddenLabel: literalValues(term.hiddenLabels, languages),
    definition: literalValues(term.scopeNotes, languages),
    scopeNote: literalValues(term.scopeNotes, languages),
    seeAlso: term.seeAlso.map((seeAlso: RDF.NamedNode) => seeAlso.value),
    broader: term.broaderTerms.map((related) => ({
      uri: related.id.value,
      prefLabel: literalValues(related.prefLabels, languages),
    })),
    narrower: term.narrowerTerms.map((related) => ({
      uri: related.id.value,
      prefLabel: literalValues(related.prefLabels, languages),
    })),
    related: term.relatedTerms.map((related) => ({
      uri: related.id.value,
      prefLabel: literalValues(related.prefLabels, languages),
    })),
    exactMatch: term.exactMatches.map((exactMatch) => ({
      uri: exactMatch.id.value,
      prefLabel: literalValues(exactMatch.prefLabels, languages),
    })),
    place: denotedPlace(term, (literals) => placeLabels(literals, languages)),
    person: denotedPerson(
      term,
      (literals) => placeLabels(literals, languages),
      (sets) => placeLabelsAcross(sets, languages),
    ),
  };
}

/**
 * A place’s labels are language-tagged in the monolingual API too, since the node arrived after
 * `Term`’s plain-string labels were frozen. The language selection still follows the labels
 * around it – the same Dutch default and English fallback that {@link literalValues} applies –
 * so a place is named the way its term is labelled.
 */
const placeLabels = (literals: RDF.Literal[], languages: string[] = ['nl']) => {
  const labels = filterLiteralsByLanguage(literals, languages);
  return labels.length > 0
    ? labels
    : filterLiteralsByLanguage(literals, ['en']);
};

/**
 * {@link placeLabels} over several name lists at once, falling back to English only when none of
 * them has a name in the requested languages. Applied per list, the fallback would keep a
 * reference by its English name beside the one by its Dutch name, since each is a list of one.
 */
const placeLabelsAcross = (
  sets: RDF.Literal[][],
  languages: string[] = ['nl'],
) => {
  const labels = sets.map((literals) =>
    filterLiteralsByLanguage(literals, languages),
  );
  return labels.some((literals) => literals.length > 0)
    ? labels
    : sets.map((literals) => filterLiteralsByLanguage(literals, ['en']));
};

function source(
  distribution: Distribution,
  dataset: Dataset,
  catalogLanguage: string,
  statusClient?: StatusClient,
) {
  return {
    uri: dataset.iri,
    name: dataset.name[catalogLanguage],
    alternateName: dataset.alternateName?.[catalogLanguage],
    description: dataset.description[catalogLanguage],
    mainEntityOfPage: [dataset.mainEntityOfPage],
    inLanguage: dataset.inLanguage,
    creators: dataset.creators.map((creator) => ({
      uri: creator.iri,
      name: creator.name[catalogLanguage] ?? Object.values(creator.name)[0],
      alternateName:
        creator.alternateName[catalogLanguage] ?? creator.alternateName[''],
    })),
    genres: dataset.genres.map(async (genre) => ({
      uri: genre.toString(),
      name: (await dereferenceGenre(genre))?.name[catalogLanguage] ?? 'Unknown',
    })),
    features: distribution.features.map((feature: Feature) => ({
      type: Object.entries(FeatureType).find(
        ([_, val]) => val === feature.type,
      )?.[0],
      url: feature.url?.toString() ?? null,
    })),
    status: statusClient?.getStatus(dataset.iri) ?? null,
  };
}

export const resolvers = {
  Query: {
    sources: listSources,
    terms: queryTerms,
    lookup: lookupTerms,
  },
  TermsResult: {
    resolveType(result: TermsResult) {
      if (result instanceof TimeoutError) {
        return 'TimeoutError';
      }

      if (result instanceof ServerError) {
        return 'ServerError';
      }

      if (result instanceof TranslatedTerms) {
        return 'TranslatedTerms';
      }

      return 'Terms';
    },
  },
  SourceResult: {
    resolveType(result: SourceResult) {
      if (result instanceof SourceNotFoundError) {
        return 'SourceNotFoundError';
      }

      return 'Source';
    },
  },
  LookupResult: {
    resolveType(result: LookupResult | { type: 'TranslatedTerm' }) {
      if (result instanceof NotFoundError) {
        return 'NotFoundError';
      }

      if (result instanceof TimeoutError) {
        return 'TimeoutError';
      }

      if (result instanceof ServerError) {
        return 'ServerError';
      }

      if ('type' in result) {
        return 'TranslatedTerm';
      }

      return 'Term';
    },
  },
};
