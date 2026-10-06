import {
  Entity,
  filterLiteralsByLanguage,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';

// A source that only names its places states one place per name, so the language is selected over
// all of them at once: judged one by one, the English name would be kept beside the Dutch one.
// A place the source identifies but does not name is shown by its IRI.
export const placeNames = (places: Entity[], language: string) => {
  const languages = places.some(
    (place) => filterLiteralsByLanguage(place.names, [language]).length > 0,
  )
    ? [language]
    : ['en'];

  return places
    .map(
      (place) =>
        filterLiteralsByLanguage(place.names, languages)[0]?.value ??
        place.iri?.value,
    )
    .filter((name) => name !== undefined);
};
