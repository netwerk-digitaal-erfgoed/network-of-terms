import {
  Entity,
  filterLiteralsByLanguage,
  OccupationRole,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import * as RDF from '@rdfjs/types';

// The entities a source mentions – places, genders – by name. A source that only names them states
// one entity per name, so the language is selected over all of them at once: judged one by one,
// the English name would be kept beside the Dutch one. An entity the source identifies is one
// entity whatever its names, so it falls back on its own: to its English name, to any name, or to
// its IRI when the source does not name it.
export const entityNames = (entities: Entity[], language: string) => {
  const languages = entities.some(
    (entity) => filterLiteralsByLanguage(entity.names, [language]).length > 0,
  )
    ? [language]
    : ['en'];

  const named = entities
    .map((entity) => ({
      iri: entity.iri?.value,
      name:
        filterLiteralsByLanguage(entity.names, languages)[0]?.value ??
        (entity.iri === undefined
          ? undefined
          : (filterLiteralsByLanguage(entity.names, ['en'])[0]?.value ??
            entity.names[0]?.value ??
            entity.iri.value)),
    }))
    .filter(
      (entity): entity is { iri: string | undefined; name: string } =>
        entity.name !== undefined,
    );

  // An entity the source states twice is named once, and so is a name the source only states
  // beside an entity it identifies by that name. Entities the source identifies apart keep their
  // names, even when they share one, such as two places called Bergen.
  const identifiedNames = new Set(
    named.filter((entity) => entity.iri !== undefined).map(({ name }) => name),
  );
  return named
    .filter((entity, index) =>
      entity.iri === undefined
        ? !identifiedNames.has(entity.name) &&
          named.findIndex(
            (other) => other.iri === undefined && other.name === entity.name,
          ) === index
        : named.findIndex((other) => other.iri === entity.iri) === index,
    )
    .map(({ name }) => name);
};

// What a person does or did, as entities: the occupation the source identifies, named by its
// vocabulary, and the role by the names the source gives it, such as ‘hofschilder’ beside the
// occupation ‘schilder’. Where the vocabulary gives the occupation no name, the role’s names
// name it.
export const occupationEntities = (roles: OccupationRole[]) =>
  roles.flatMap((role) => {
    const roleEntities =
      role.roleNames.length === 0
        ? []
        : [new Entity(undefined, role.roleNames)];
    if (role.occupation === undefined) {
      return roleEntities;
    }
    const iri =
      role.occupation.id.termType === 'NamedNode'
        ? role.occupation.id
        : undefined;

    return role.occupation.prefLabels.length === 0
      ? [new Entity(iri, role.roleNames)]
      : [new Entity(iri, role.occupation.prefLabels), ...roleEntities];
  });

// Each occupation is one entity, so the language is selected as it is for places. A source that
// states one occupation for several periods names it once. A role’s names are the source’s own,
// which it seldom translates, so like a person’s names they are kept in another language too,
// unless they only repeat an occupation’s name.
export const occupationNames = (roles: OccupationRole[], language: string) => {
  const occupationLabels = new Set(
    roles.flatMap((role) =>
      (role.occupation?.prefLabels ?? []).map(({ value }) => value),
    ),
  );

  return [
    ...new Set([
      ...entityNames(occupationEntities(roles), language),
      ...personalNames(
        roles
          .flatMap((role) => role.roleNames)
          .filter(({ value }) => !occupationLabels.has(value)),
        language,
      ),
    ]),
  ];
};

// A person’s names are not translated, so a name the source states in another language than the
// requested one is still theirs, and no more so in English than in any other language.
export const personalNames = (names: RDF.Literal[], language: string) => {
  const inLanguage = filterLiteralsByLanguage(names, [language]);
  return [
    ...new Set(
      (inLanguage.length > 0 ? inLanguage : names).map((name) => name.value),
    ),
  ];
};
