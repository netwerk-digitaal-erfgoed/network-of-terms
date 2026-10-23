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
  Entity,
  OccupationRole,
  RelatedTerm,
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
      () => (literals) => filterLiteralsByLanguage(literals, languages),
    ),
  };
}

/**
 * The place that the term denotes, or null if its source describes none. Whether it does is decided
 * on everything the source holds, not on what survives the language filter, so it is a fact about
 * the term rather than about the requested language.
 */
function denotedPlace(
  term: Term,
  inRequestedLanguages: (literals: RDF.Literal[]) => RDF.Literal[],
) {
  const place = term.place;
  return place === undefined
    ? null
    : {
        name: inRequestedLanguages(place.names),
        latitude: place.latitude ?? null,
        longitude: place.longitude ?? null,
        addressCountry: place.addressCountry ?? null,
        additionalType: place.additionalTypes.map((additionalType) => ({
          uri: additionalType.id.value,
          name: inRequestedLanguages(additionalType.prefLabels),
        })),
      };
}

/**
 * The person that the term denotes, or null if its source describes none, decided as for
 * {@link denotedPlace}.
 *
 * The API returns one birth and one death date, documented as EDTF, which reads a plain ISO 8601
 * date, an interval and a qualified date alike. Where a source states several – Wikidata can, when
 * its sources disagree – the first is taken.
 */
function denotedPerson(
  term: Term,
  inRequestedLanguages: (literals: RDF.Literal[]) => RDF.Literal[],
  acrossSet: LanguageSelector,
) {
  const person = term.person;
  if (person === undefined) {
    return null;
  }

  const entities = entitiesIn(acrossSet);
  // A relative is one person whatever its names, so its names fall back on their own.
  const references = (relatives: RelatedTerm[]) =>
    relatives.map((relative) => ({
      uri: relative.id.value,
      name: inRequestedLanguages(relative.prefLabels),
    }));
  return {
    givenName: inRequestedLanguages(person.givenNames),
    familyName: inRequestedLanguages(person.familyNames),
    birthDate: person.birthDates[0] ?? null,
    deathDate: person.deathDates[0] ?? null,
    birthPlace: entities(person.birthPlaces),
    deathPlace: entities(person.deathPlaces),
    hasOccupation: rolesIn(acrossSet)(person.occupations),
    nationality: entities(person.nationalities),
    gender: entities(person.genders),
    parent: references(person.parents),
    children: references(person.children),
    spouse: references(person.spouses),
    sibling: references(person.siblings),
  };
}

/**
 * A role is kept when its occupation or its name survives the language filter; a period alone
 * would say ‘did something from 1625 to 1669’. A source that only names its occupations states
 * one role per name, since nothing tells its Dutch and English names for one occupation apart
 * from its names for two, so once the names in the languages the client did not ask for are
 * gone, a role may have nothing left and is dropped rather than returned empty.
 */
const rolesIn = (acrossSet: LanguageSelector) => (roles: OccupationRole[]) => {
  // Every name list of every role decides the language selection together, so that a fallback
  // applies to the set and not to each role on its own.
  const select = acrossSet(
    roles.flatMap((role) => [
      role.occupation?.prefLabels ?? [],
      role.roleNames,
    ]),
  );
  return roles
    .map((role) => ({
      occupation:
        role.occupation === undefined
          ? null
          : {
              uri: role.occupation.id.value,
              name: select(role.occupation.prefLabels),
            },
      roleName: select(role.roleNames),
      startDate: role.startDate ?? null,
      endDate: role.endDate ?? null,
    }))
    .filter((role) => role.occupation !== null || role.roleName.length > 0);
};

/**
 * The entities a source mentions, as the API states them. An entity the source only names is one
 * per name, since nothing tells its Dutch and English names for one thing apart from its names
 * for two, so the language selection runs over all of them at once: a fallback that judged each
 * on its own would keep the one named in English beside the one named in Dutch. An unlinked entity
 * with no name left in the requested languages is dropped rather than returned empty.
 */
const entitiesIn = (acrossSet: LanguageSelector) => (entities: Entity[]) => {
  const select = acrossSet(entities.map((entity) => entity.names));
  return entities
    .map((entity) => ({
      uri: entity.iri?.value ?? null,
      name: select(entity.names),
    }))
    .filter((entity) => entity.uri !== null || entity.name.length > 0);
};

/**
 * Given every name list a field holds, the selection to apply to each of them: the languages the
 * client asked for, or a fallback that the set as a whole earns.
 */
type LanguageSelector = (
  sets: RDF.Literal[][],
) => (literals: RDF.Literal[]) => RDF.Literal[];

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
 * {@link placeLabels} decided over several name lists at once, falling back to English only when
 * none of them has a name in the requested languages. Applied per list, the fallback would keep
 * an entity by its English name beside the one by its Dutch name, since each is a list of one.
 */
const placeLabelsAcross =
  (sets: RDF.Literal[][], languages: string[] = ['nl']) =>
  (literals: RDF.Literal[]) =>
    filterLiteralsByLanguage(
      literals,
      sets.some(
        (names) => filterLiteralsByLanguage(names, languages).length > 0,
      )
        ? languages
        : ['en'],
    );

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
