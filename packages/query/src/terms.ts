import type RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';

export class Term {
  constructor(
    readonly id: RDF.Term,
    readonly types: RDF.Term[],
    readonly prefLabels: RDF.Literal[],
    readonly altLabels: RDF.Literal[],
    readonly hiddenLabels: RDF.Literal[],
    readonly scopeNotes: RDF.Literal[],
    readonly seeAlso: RDF.NamedNode[],
    readonly broaderTerms: RelatedTerm[],
    readonly narrowerTerms: RelatedTerm[],
    readonly relatedTerms: RelatedTerm[],
    readonly exactMatches: RelatedTerm[],
    readonly datasetIri: RDF.Term | undefined,
    readonly score: RDF.Literal | undefined,
    // What the source states about the place, person or organization the term denotes, beyond
    // what SKOS states.
    readonly place: Place | undefined = undefined,
    readonly person: Person | undefined = undefined,
    readonly organization: DenotedOrganization | undefined = undefined,
  ) {}
}

/**
 * The place a term denotes: what SKOS cannot state about it, so the term’s position in the place
 * hierarchy stays on `broaderTerms` and `narrowerTerms`. A term has one only when it is typed
 * `schema:Place` and its source states at least one of these, so a place without any reads as no
 * place rather than as an empty one.
 */
export class Place {
  constructor(
    readonly names: RDF.Literal[],
    readonly latitude: number | undefined,
    readonly longitude: number | undefined,
    // An ISO 3166-1 alpha-2 code, such as ‘NL’.
    readonly addressCountry: string | undefined,
    readonly additionalTypes: RelatedTerm[],
  ) {}
}

/**
 * The person a term denotes: what SKOS cannot state about them, so the full names stay on the
 * term’s labels and the alignments on `exactMatches`. A term has one only when it is typed
 * `schema:Person` and its source states at least one of these.
 *
 * Dates are EDTF strings, passed through as the source states them.
 */
export class Person {
  constructor(
    readonly givenNames: RDF.Literal[],
    readonly familyNames: RDF.Literal[],
    readonly birthDates: string[],
    readonly deathDates: string[],
    readonly birthPlaces: Entity[],
    readonly deathPlaces: Entity[],
    readonly occupations: OccupationRole[],
    readonly nationalities: Entity[],
    readonly genders: Entity[],
    // Family members, each a person the source identifies, with whatever names it gives them.
    readonly parents: RelatedTerm[],
    readonly children: RelatedTerm[],
    readonly spouses: RelatedTerm[],
    readonly siblings: RelatedTerm[],
  ) {}
}

/**
 * The organization a term denotes: what SKOS cannot state about it, in Schema.org’s organization
 * properties. A term has one only when it is typed `schema:Organization` and its source states at
 * least one of these. Named apart from {@link Organization}, which is the organization that
 * publishes a dataset.
 *
 * Dates are EDTF strings, passed through as the source states them, as for a {@link Person}.
 */
export class DenotedOrganization {
  constructor(
    // What kind of organization this is, in the source’s own vocabulary, as for a place.
    readonly additionalTypes: RelatedTerm[],
    readonly foundingDates: string[],
    readonly dissolutionDates: string[],
    readonly locations: Location[],
    // The organizations it belongs to, each one the source identifies.
    readonly parentOrganizations: RelatedTerm[],
    // The periods in which the organization was active, ordered by when they began.
    readonly events: Event[],
  ) {}
}

/**
 * A place an organization is or was at: an IRI where the source links one, with the names its
 * vocabulary gives it, or an address the source states only as text, such as the KB’s
 * `schema:PostalAddress` with a locality and a country.
 */
export class Location {
  constructor(
    readonly iri: RDF.NamedNode | undefined,
    readonly names: RDF.Literal[],
    // An ISO 3166-1 alpha-2 code, as for a {@link Place}.
    readonly addressCountry: string | undefined,
  ) {}
}

/**
 * A period in which an organization was active, in the shape of Schema.org’s `Event`: when it
 * began and ended, and where, so far as the source states them.
 */
export class Event {
  constructor(
    readonly startDate: string | undefined,
    readonly endDate: string | undefined,
    readonly locations: Location[],
  ) {}
}

export class RelatedTerm {
  constructor(
    readonly id: RDF.Term,
    readonly prefLabels: RDF.Literal[],
  ) {}
}

/**
 * Something a source mentions: identified by an IRI where the source links it, with whatever names
 * its vocabulary gives that IRI, and by name alone where it does not. WO2-biografieën states birth
 * places as names only; RKDartists states a nationality as an IRI beside literals, with nothing
 * pairing the two unless there is only one. Each object of the property is one entity, so a
 * source that states several has mentioned several, which for a birthplace are alternatives.
 */
export class Entity {
  constructor(
    readonly iri: RDF.NamedNode | undefined,
    readonly names: RDF.Literal[],
  ) {}
}

/**
 * What a person does or did, in the shape of Schema.org’s `Role`: an occupation the source
 * identifies, or a role the source only names, and the period where the source states one.
 *
 * Schema.org lets a `Role` sit between `schema:hasOccupation` and the `Occupation`, repeating
 * `schema:hasOccupation` on the role to reach it, and puts the dates and the `roleName` on the
 * role. A source that constructs no role but a bare occupation is read as a role without a period:
 * an IRI becomes the occupation, a literal the role’s name.
 */
export class OccupationRole {
  constructor(
    readonly occupation: RelatedTerm | undefined,
    readonly roleNames: RDF.Literal[],
    // EDTF strings, as for the dates of a {@link Person}.
    readonly startDate: string | undefined,
    readonly endDate: string | undefined,
  ) {}
}

class SparqlResultTerm {
  constructor(readonly id: RDF.Term) {}
  types: RDF.Term[] = [];
  prefLabels: RDF.Literal[] = [];
  altLabels: RDF.Literal[] = [];
  hiddenLabels: RDF.Literal[] = [];
  scopeNotes: RDF.Literal[] = [];
  seeAlso: RDF.NamedNode[] = [];
  broaderTerms: RDF.Term[] = [];
  narrowerTerms: RDF.Term[] = [];
  relatedTerms: RDF.Term[] = [];
  exactMatches: RDF.Term[] = [];
  inScheme: RDF.Term | undefined = undefined;
  score: RDF.Literal | undefined = undefined;
  latitude: RDF.Literal | undefined = undefined;
  longitude: RDF.Literal | undefined = undefined;
  names: RDF.Literal[] = [];
  geo: RDF.Term | undefined = undefined;
  addressCountry: RDF.Literal | undefined = undefined;
  addressLocalities: RDF.Literal[] = [];
  additionalTypes: RDF.Term[] = [];
  birthDates: RDF.Literal[] = [];
  deathDates: RDF.Literal[] = [];
  birthPlaces: RDF.Term[] = [];
  deathPlaces: RDF.Term[] = [];
  occupations: RDF.Term[] = [];
  nationalities: RDF.Term[] = [];
  givenNames: RDF.Literal[] = [];
  familyNames: RDF.Literal[] = [];
  genders: RDF.Term[] = [];
  parents: RDF.Term[] = [];
  children: RDF.Term[] = [];
  spouses: RDF.Term[] = [];
  siblings: RDF.Term[] = [];
  foundingDates: RDF.Literal[] = [];
  dissolutionDates: RDF.Literal[] = [];
  locations: RDF.Term[] = [];
  parentOrganizations: RDF.Term[] = [];
  events: RDF.Term[] = [];
  // Read from a schema:Role or schema:Event node a term points at, never from the term itself.
  roleNames: RDF.Literal[] = [];
  startDate: RDF.Literal | undefined = undefined;
  endDate: RDF.Literal | undefined = undefined;
}

export class TermsTransformer {
  private termsIris: Set<string> = new Set();
  private termsMap: Map<string, SparqlResultTerm> = new Map();
  private readonly predicateToPropertyMap = new Map<string, string>([
    ['http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'types'],
    ['http://www.w3.org/2000/01/rdf-schema#seeAlso', 'seeAlso'],
    ['http://www.w3.org/2004/02/skos/core#prefLabel', 'prefLabels'],
    ['http://www.w3.org/2008/05/skos#prefLabel', 'prefLabels'],
    ['http://www.w3.org/2004/02/skos/core#altLabel', 'altLabels'],
    ['http://www.w3.org/2008/05/skos#altLabel', 'altLabels'],
    ['http://www.w3.org/2004/02/skos/core#hiddenLabel', 'hiddenLabels'],
    ['http://www.w3.org/2008/05/skos#hiddenLabel', 'hiddenLabels'],
    ['http://www.w3.org/2004/02/skos/core#scopeNote', 'scopeNotes'],
    ['http://www.w3.org/2008/05/skos#scopeNote', 'scopeNotes'],
    ['http://www.w3.org/2004/02/skos/core#broader', 'broaderTerms'],
    ['http://www.w3.org/2008/05/skos#broader', 'broaderTerms'],
    ['http://www.w3.org/2004/02/skos/core#narrower', 'narrowerTerms'],
    ['http://www.w3.org/2008/05/skos#narrower', 'narrowerTerms'],
    ['http://www.w3.org/2004/02/skos/core#related', 'relatedTerms'],
    ['http://www.w3.org/2008/05/skos#related', 'relatedTerms'],
    ['http://www.w3.org/2004/02/skos/core#exactMatch', 'exactMatches'],
    ['http://www.w3.org/2008/05/skos#exactMatch', 'exactMatches'],
    ['http://www.w3.org/2004/02/skos/core#inScheme', 'inScheme'],
    ['http://purl.org/voc/vrank#simpleRank', 'score'],
    // Both Schema.org namespaces, because source queries use either one.
    ['https://schema.org/name', 'names'],
    ['http://schema.org/name', 'names'],
    ['https://schema.org/geo', 'geo'],
    ['http://schema.org/geo', 'geo'],
    ['https://schema.org/latitude', 'latitude'],
    ['http://schema.org/latitude', 'latitude'],
    ['https://schema.org/longitude', 'longitude'],
    ['http://schema.org/longitude', 'longitude'],
    ['https://schema.org/addressCountry', 'addressCountry'],
    ['http://schema.org/addressCountry', 'addressCountry'],
    ['https://schema.org/addressLocality', 'addressLocalities'],
    ['http://schema.org/addressLocality', 'addressLocalities'],
    ['https://schema.org/additionalType', 'additionalTypes'],
    ['http://schema.org/additionalType', 'additionalTypes'],
    ['https://schema.org/birthDate', 'birthDates'],
    ['http://schema.org/birthDate', 'birthDates'],
    ['https://schema.org/deathDate', 'deathDates'],
    ['http://schema.org/deathDate', 'deathDates'],
    ['https://schema.org/birthPlace', 'birthPlaces'],
    ['http://schema.org/birthPlace', 'birthPlaces'],
    ['https://schema.org/deathPlace', 'deathPlaces'],
    ['http://schema.org/deathPlace', 'deathPlaces'],
    ['https://schema.org/hasOccupation', 'occupations'],
    ['http://schema.org/hasOccupation', 'occupations'],
    ['https://schema.org/nationality', 'nationalities'],
    ['http://schema.org/nationality', 'nationalities'],
    ['https://schema.org/givenName', 'givenNames'],
    ['http://schema.org/givenName', 'givenNames'],
    ['https://schema.org/familyName', 'familyNames'],
    ['http://schema.org/familyName', 'familyNames'],
    ['https://schema.org/gender', 'genders'],
    ['http://schema.org/gender', 'genders'],
    ['https://schema.org/parent', 'parents'],
    ['http://schema.org/parent', 'parents'],
    ['https://schema.org/children', 'children'],
    ['http://schema.org/children', 'children'],
    ['https://schema.org/spouse', 'spouses'],
    ['http://schema.org/spouse', 'spouses'],
    ['https://schema.org/sibling', 'siblings'],
    ['http://schema.org/sibling', 'siblings'],
    ['https://schema.org/foundingDate', 'foundingDates'],
    ['http://schema.org/foundingDate', 'foundingDates'],
    ['https://schema.org/dissolutionDate', 'dissolutionDates'],
    ['http://schema.org/dissolutionDate', 'dissolutionDates'],
    ['https://schema.org/location', 'locations'],
    ['http://schema.org/location', 'locations'],
    ['https://schema.org/parentOrganization', 'parentOrganizations'],
    ['http://schema.org/parentOrganization', 'parentOrganizations'],
    ['https://schema.org/event', 'events'],
    ['http://schema.org/event', 'events'],
    ['https://schema.org/roleName', 'roleNames'],
    ['http://schema.org/roleName', 'roleNames'],
    ['https://schema.org/startDate', 'startDate'],
    ['http://schema.org/startDate', 'startDate'],
    ['https://schema.org/endDate', 'endDate'],
    ['http://schema.org/endDate', 'endDate'],
  ]);

  fromQuad(quad: RDF.Quad): void {
    const subject = quad.subject;
    const propertyName = this.predicateToPropertyMap.get(quad.predicate.value);
    const currentTerm =
      this.termsMap.get(subject.value) ?? new SparqlResultTerm(subject);
    this.termsMap.set(subject.value, currentTerm);

    // skos:Concepts are the top-level search results, which we track in termsIris.
    if (
      propertyName === 'types' &&
      (quad.object.value === 'http://www.w3.org/2004/02/skos/core#Concept' ||
        quad.object.value === 'http://www.w3.org/2008/05/skos#Concept')
    ) {
      this.termsIris.add(subject.value);
    }

    if (propertyName !== undefined) {
      const propertyValue = (currentTerm as any)[propertyName]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (Array.isArray(propertyValue)) {
        // Prevent duplicate prefLabel values due to duplicate quads.
        if (!propertyValue.find((value) => value.equals(quad.object))) {
          propertyValue.push(quad.object);
        }
      } else {
        (currentTerm as any)[propertyName] = quad.object; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }
  }

  asArray(): Term[] {
    return [...this.termsIris].map((iri) => {
      const term = this.termsMap.get(iri)!;

      return new Term(
        term.id,
        term.types,
        term.prefLabels,
        term.altLabels,
        term.hiddenLabels,
        term.scopeNotes,
        term.seeAlso,
        this.mapRelatedTerms(term.broaderTerms).sort(alphabeticallyByPrefLabel),
        this.mapRelatedTerms(term.narrowerTerms).sort(
          alphabeticallyByPrefLabel,
        ),
        this.mapRelatedTerms(term.relatedTerms).sort(alphabeticallyByPrefLabel),
        this.mapRelatedTerms(term.exactMatches).sort(alphabeticallyByPrefLabel),
        term.inScheme,
        term.score,
        this.place(term),
        this.person(term),
        this.organization(term),
      );
    });
  }

  private place = (term: SparqlResultTerm) => {
    if (!term.types.some(isPlaceClass)) {
      return undefined;
    }

    const location = this.location(term);
    const place = new Place(
      term.names,
      numberValue(location.latitude),
      numberValue(location.longitude),
      // An empty country is as unusable as an empty coordinate, and ISO 3166-1 has no empty code.
      stringValue(location.addressCountry),
      term.additionalTypes.map(this.namedType).sort(alphabeticallyByPrefLabel),
    );

    return place.names.length === 0 &&
      place.latitude === undefined &&
      place.longitude === undefined &&
      place.addressCountry === undefined &&
      place.additionalTypes.length === 0
      ? undefined
      : place;
  };

  private person = (term: SparqlResultTerm) => {
    if (!term.types.some(isPersonClass)) {
      return undefined;
    }

    const person = new Person(
      term.givenNames,
      term.familyNames,
      dateValues(term.birthDates),
      dateValues(term.deathDates),
      term.birthPlaces.flatMap(this.entity),
      term.deathPlaces.flatMap(this.entity),
      term.occupations.flatMap(this.role),
      term.nationalities.flatMap(this.entity),
      term.genders
        .flatMap(this.entity)
        .map(normalisedGender)
        .filter(firstOfEachIri),
      this.relatives(term, 'parents'),
      this.relatives(term, 'children'),
      this.relatives(term, 'spouses'),
      this.relatives(term, 'siblings'),
    );

    // Every field is a list, so a person without any is one whose source states nothing.
    return Object.values(person).every(
      (values: unknown[]) => values.length === 0,
    )
      ? undefined
      : person;
  };

  private organization = (term: SparqlResultTerm) => {
    if (!term.types.some(isOrganizationClass)) {
      return undefined;
    }

    const organization = new DenotedOrganization(
      term.additionalTypes
        .filter((object) => object.termType === 'NamedNode')
        .map(this.namedType)
        .sort(alphabeticallyByPrefLabel),
      dateValues(term.foundingDates),
      dateValues(term.dissolutionDates),
      this.locations(term.locations),
      term.parentOrganizations
        .filter((object) => object.termType === 'NamedNode')
        .map(this.namedType)
        .sort(alphabeticallyByPrefLabel),
      term.events.flatMap(this.event).sort(byStartDate),
    );

    // Every field is a list, so an organization without any is one whose source states nothing.
    return Object.values(organization).every(
      (values: unknown[]) => values.length === 0,
    )
      ? undefined
      : organization;
  };

  /**
   * What `schema:event` points at, as an {@link Event}. A period that states neither when nor
   * where says nothing, so it yields nothing.
   */
  private event = (object: RDF.Term): Event[] => {
    const node =
      object.termType === 'NamedNode' || object.termType === 'BlankNode'
        ? this.termsMap.get(object.value)
        : undefined;
    if (node === undefined) {
      return [];
    }

    const event = new Event(
      stringValue(node.startDate),
      stringValue(node.endDate),
      this.locations(node.locations),
    );
    return event.startDate === undefined &&
      event.endDate === undefined &&
      event.locations.length === 0
      ? []
      : [event];
  };

  /**
   * What `schema:location` points at, as the {@link Location}s it names. A `schema:PostalAddress`
   * or a blank node is a place the source states only as text, read for its locality or name and
   * its country, and never by its IRI: the KB mints one per address that identifies nothing outside
   * it. Any other IRI is a place the source links, named as {@link namedType} names one; a literal
   * is a name alone. An address that states nothing is dropped, and one stated twice – the KB
   * states a street address and a post office box in the same town – is returned once.
   */
  private locations = (objects: RDF.Term[]) =>
    objects
      .flatMap((object): Location[] => {
        const node = this.termsMap.get(object.value);
        if (
          object.termType === 'BlankNode' ||
          node?.types.some(isPostalAddressClass)
        ) {
          const names = [
            ...(node?.addressLocalities ?? []),
            ...(node?.names ?? []),
          ];
          const country = stringValue(node?.addressCountry);
          return names.length === 0 && country === undefined
            ? []
            : [new Location(undefined, names, country)];
        }
        // Otherwise a location is named as any entity is: a linked place by the names its
        // vocabulary gives it, a literal as a name alone.
        return this.entity(object).map(
          (entity) =>
            new Location(
              entity.iri,
              entity.names,
              stringValue(node?.addressCountry),
            ),
        );
      })
      .filter(
        (location, index, locations) =>
          locations.findIndex((other) => sameLocation(location, other)) ===
          index,
      );

  /**
   * An object of a property as the {@link Entity} it mentions: an IRI named the way
   * {@link namedType} names one, or a literal as a name alone. A blank node is something the source
   * has given no way to read, so it yields nothing.
   */
  private entity = (object: RDF.Term): Entity[] => {
    if (object.termType === 'NamedNode') {
      return [new Entity(object, this.namedType(object).prefLabels)];
    }
    if (object.termType === 'Literal') {
      return [new Entity(undefined, [object])];
    }
    return [];
  };

  /**
   * The persons a family relation points at, named as {@link namedType} names an IRI. Only an IRI
   * identifies a relative: a literal is the source’s sentence about one, such as the NTA’s
   * ‘vanaf 1607, echtgenoot van: …’, and names no person.
   *
   * A `schema:Role` node between the person and the relative, as STCN states for printers, is
   * followed the way Schema.org reads one: the relation is repeated on the role to reach the
   * relative.
   */
  private relatives = (
    term: SparqlResultTerm,
    relation: 'parents' | 'children' | 'spouses' | 'siblings',
  ) =>
    term[relation]
      .flatMap((object) => {
        const node = this.termsMap.get(object.value);
        return node !== undefined && node.types.some(isRoleClass)
          ? node[relation]
          : [object];
      })
      .filter((object) => object.termType === 'NamedNode')
      .map(this.namedType)
      .sort(alphabeticallyByPrefLabel);

  /**
   * What `schema:hasOccupation` points at, as a {@link Role}: a `schema:Role` node is read for
   * its occupation, name and period, and anything else is a bare occupation, which
   * {@link reference} reads as a role without a period.
   */
  private role = (object: RDF.Term): OccupationRole[] => {
    // A role node may be a blank node too, as the schema:geo node may; an IRI is preferred for
    // the reason the catalog README gives, not required.
    const node =
      object.termType === 'NamedNode' || object.termType === 'BlankNode'
        ? this.termsMap.get(object.value)
        : undefined;
    if (node === undefined || !node.types.some(isRoleClass)) {
      // A bare occupation is a role without a period: an IRI its occupation, a literal its name.
      return this.entity(object).map((entity) =>
        entity.iri === undefined
          ? new OccupationRole(undefined, entity.names, undefined, undefined)
          : new OccupationRole(
              this.namedType(entity.iri),
              [],
              undefined,
              undefined,
            ),
      );
    }

    // The property is repeated on the role to reach the occupation, per Schema.org; a role may
    // also be named without one. Only the first occupation is taken, since a role is one thing. An
    // occupation the role only names is a name for the role, as it is on a term.
    const mentioned = node.occupations.flatMap(this.entity);
    const linked = mentioned.find((entity) => entity.iri !== undefined)?.iri;
    const occupation =
      linked === undefined ? undefined : this.namedType(linked);
    const roleNames = [
      ...node.roleNames,
      ...mentioned
        .filter((entity) => entity.iri === undefined)
        .flatMap((entity) => entity.names),
    ];
    return occupation === undefined && roleNames.length === 0
      ? []
      : [
          new OccupationRole(
            occupation,
            roleNames,
            stringValue(node.startDate),
            stringValue(node.endDate),
          ),
        ];
  };

  /**
   * Where the term is, read from the `schema:geo` node it points at and from the term itself.
   *
   * Sources hang the coordinates and the country off a `schema:geo` node, because
   * `schema:addressCountry` does not have `schema:Place` in its domain and would be an
   * unsanctioned triple on the term itself. That costs this transformer its only traversal;
   * everything else stays a flat predicate→property map.
   *
   * Each property falls back to the term separately, so a source that states its coordinates flat
   * and adds a `schema:geo` node only to carry the country – the natural way to migrate, since the
   * country is the one property that cannot stay flat – keeps both.
   */
  private location = (term: SparqlResultTerm) => {
    const geo =
      term.geo === undefined ? undefined : this.termsMap.get(term.geo.value);

    return {
      latitude: geo?.latitude ?? term.latitude,
      longitude: geo?.longitude ?? term.longitude,
      addressCountry: geo?.addressCountry ?? term.addressCountry,
    };
  };

  /**
   * An IRI from a vocabulary outside this source, with whatever names the source gave it.
   *
   * A vocabulary names its own classes as it sees fit – the GeoNames ontology uses
   * `skos:prefLabel`, others `schema:name` – and a source cannot be asked to translate between
   * them, so both are read. Most vocabularies are published without any name at all, and then the
   * IRI is all a client gets.
   */
  private namedType = (iri: RDF.Term) => {
    const type = this.termsMap.get(iri.value);
    const names = [...(type?.prefLabels ?? []), ...(type?.names ?? [])];

    return new RelatedTerm(
      iri,
      names.filter(
        (name, index) =>
          names.findIndex((other) => other.equals(name)) === index,
      ),
    );
  };

  /**
   * Map related IRIs to their related terms, making sure to only accept complete related terms.
   *
   * Related terms can be incomplete because of the SPARQL query limit (see
   * https://github.com/netwerk-digitaal-erfgoed/network-of-terms/issues/36).
   */
  private mapRelatedTerms = (terms: RDF.Term[]) =>
    terms.reduce((acc: RelatedTerm[], iri: RDF.Term) => {
      const term = this.termsMap.get(iri.value);
      acc.push(new RelatedTerm(iri, term?.prefLabels ?? []));
      return acc;
    }, []);
}

// Both Schema.org namespaces, because source queries use either one.
const isSchemaClass = (name: string) => (type: RDF.Term) =>
  type.value === `https://schema.org/${name}` ||
  type.value === `http://schema.org/${name}`;
const isRoleClass = isSchemaClass('Role');
const isPlaceClass = isSchemaClass('Place');
const isPersonClass = isSchemaClass('Person');
const isOrganizationClass = isSchemaClass('Organization');
const isPostalAddressClass = isSchemaClass('PostalAddress');

const sameLocation = (location: Location, other: Location) =>
  location.iri !== undefined || other.iri !== undefined
    ? location.iri !== undefined &&
      other.iri !== undefined &&
      location.iri.equals(other.iri)
    : location.addressCountry === other.addressCountry &&
      location.names.length === other.names.length &&
      location.names.every((name) =>
        other.names.some((otherName) => otherName.equals(name)),
      );

// An event without a start date sorts last, since nothing says when it began. EDTF dates of the
// same precision sort as strings, compared by code point so the order does not depend on the
// runtime’s collation.
const byStartDate = (event: Event, other: Event) => {
  if (event.startDate === undefined || other.startDate === undefined) {
    return (
      Number(event.startDate === undefined) -
      Number(other.startDate === undefined)
    );
  }
  return event.startDate < other.startDate
    ? -1
    : event.startDate > other.startDate
      ? 1
      : 0;
};

// Sources are not validated, so a value may be empty or blank; that is no value.
const stringValue = (literal: RDF.Literal | undefined) =>
  literal?.value.trim() || undefined;

const dateValues = (literals: RDF.Literal[]) =>
  literals.flatMap((literal) => stringValue(literal) ?? []);

// A coordinate that is not a finite number becomes no coordinate: `Number('')` would silently
// place the term at 0°, 0°.
const numberValue = (literal: RDF.Literal | undefined) => {
  const value = stringValue(literal);
  return value !== undefined && Number.isFinite(Number(value))
    ? Number(value)
    : undefined;
};

const dataFactory = new DataFactory();

// Schema.org’s two genders, in the https namespace whichever one the source uses, so that a client
// can tell them by URI alone. Any other gender is the source’s own and passes through as it is.
const binaryGenders = new Map(
  ['Male', 'Female'].flatMap((gender) => {
    const iri = dataFactory.namedNode(`https://schema.org/${gender}`);
    return [
      [`https://schema.org/${gender}`, iri],
      [`http://schema.org/${gender}`, iri],
    ];
  }),
);

const normalisedGender = (gender: Entity) =>
  gender.iri === undefined
    ? gender
    : new Entity(
        binaryGenders.get(gender.iri.value) ?? gender.iri,
        gender.names,
      );

// One gender stated in both namespaces is one gender once normalised.
const firstOfEachIri = (entity: Entity, index: number, entities: Entity[]) =>
  entity.iri === undefined ||
  entities.findIndex((other) => other.iri?.equals(entity.iri!)) === index;

const alphabeticallyByPrefLabel = (a: RelatedTerm, b: RelatedTerm) => {
  const prefLabelA = a.prefLabels[0]?.value ?? '';
  const prefLabelB = b.prefLabels[0]?.value ?? '';
  return prefLabelA.localeCompare(prefLabelB);
};
