import {
  Entity,
  filterLiteralsByLanguage,
  literalValues,
  OccupationRole,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import * as RDF from '@rdfjs/types';

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

  return unique(
    entities
      .map(
        (entity) =>
          filterLiteralsByLanguage(entity.names, languages)[0]?.value ??
          (entity.iri === undefined
            ? undefined
            : (filterLiteralsByLanguage(entity.names, ['en'])[0]?.value ??
              entity.iri.value)),
      )
      .filter((name) => name !== undefined),
  );
};

// An occupation the source identifies is named by its vocabulary, and a role by the names the source
// gives it, such as ‘hofschilder’ beside the occupation ‘schilder’; each is one entity, so the language
// is selected as it is for places. A source that states one occupation for several periods names it
// once.
export const occupationNames = (roles: OccupationRole[], language: string) =>
  entityNames(
    roles.flatMap((role) => [
      ...(role.occupation === undefined
        ? []
        : [
            // The query package only links an occupation by its IRI.
            new Entity(
              role.occupation.id as RDF.NamedNode,
              role.occupation.prefLabels,
            ),
          ]),
      ...(role.roleNames.length === 0
        ? []
        : [new Entity(undefined, role.roleNames)]),
    ]),
    language,
  );

// A person’s names are not translated, so a name the source states in another language than the
// requested one, or in English, is still theirs.
export const personalNames = (names: RDF.Literal[], language: string) => {
  const inLanguage = literalValues(names, [language]);
  return inLanguage.length > 0
    ? inLanguage
    : unique(names.map((name) => name.value));
};

const unique = (values: string[]) => [...new Set(values)];
