import {
  Entity,
  filterLiteralsByLanguage,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

// The entities a source mentions – places, genders – by name. A source that only names them states
// one entity per name, so the language is selected over all of them at once: judged one by one,
// the English name would be kept beside the Dutch one. An entity the source identifies is one
// entity whatever its names, so it falls back on its own: to its English name, or to its IRI when
// the source does not name it.
export const entityNames = (entities: Entity[], language: string) => {
  const languages = entities.some(
    (entity) => filterLiteralsByLanguage(entity.names, [language]).length > 0,
  )
    ? [language]
    : ['en'];

  return entities
    .map(
      (entity) =>
        filterLiteralsByLanguage(entity.names, languages)[0]?.value ??
        (entity.iri === undefined
          ? undefined
          : (filterLiteralsByLanguage(entity.names, ['en'])[0]?.value ??
            entity.iri.value)),
    )
    .filter((name) => name !== undefined);
};
