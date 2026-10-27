import { TermsTransformer } from '../src/index.js';
import { DataFactory } from 'rdf-data-factory';
import type RDF from '@rdfjs/types';
import { describe, expect, it } from 'vitest';

const dataFactory = new DataFactory();
const rdf = {
  type: dataFactory.namedNode(
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  ),
};
const skos = (name: string) =>
  dataFactory.namedNode(`http://www.w3.org/2004/02/skos/core#${name}`);
const schema = (name: string) =>
  dataFactory.namedNode(`https://schema.org/${name}`);

const maastricht = dataFactory.namedNode('https://example.com/maastricht');
const geo = dataFactory.namedNode('https://example.com/maastricht#geo');

const transform = (quads: RDF.Quad[]) => {
  const transformer = new TermsTransformer();
  quads.forEach((quad) => transformer.fromQuad(quad));
  return transformer.asArray();
};

const place = (...quads: RDF.Quad[]) => [
  dataFactory.quad(maastricht, rdf.type, skos('Concept')),
  dataFactory.quad(maastricht, rdf.type, schema('Place')),
  ...quads,
];

describe('TermsTransformer', () => {
  it('reads coordinates and country through the term’s schema:geo node', () => {
    const [term] = transform(
      place(
        dataFactory.quad(maastricht, schema('geo'), geo),
        dataFactory.quad(geo, rdf.type, schema('GeoCoordinates')),
        dataFactory.quad(
          geo,
          schema('latitude'),
          dataFactory.literal('50.84833'),
        ),
        dataFactory.quad(
          geo,
          schema('longitude'),
          dataFactory.literal('5.68889'),
        ),
        dataFactory.quad(
          geo,
          schema('addressCountry'),
          dataFactory.literal('NL'),
        ),
      ),
    );

    expect(term.place?.latitude).toEqual(50.84833);
    expect(term.place?.longitude).toEqual(5.68889);
    expect(term.place?.addressCountry).toEqual('NL');
  });

  it('reads coordinates that a source states on the term itself', () => {
    const [term] = transform(
      place(
        dataFactory.quad(
          maastricht,
          schema('latitude'),
          dataFactory.literal('50.84833'),
        ),
      ),
    );

    expect(term.place?.latitude).toEqual(50.84833);
    expect(term.place?.addressCountry).toBeUndefined();
  });

  it('reads the country from the geo node and the coordinates from the term', () => {
    // How a source migrates: the country is the one property that cannot stay on the term, so a
    // schema:geo node may arrive carrying it alone while the coordinates are still stated flat.
    const [term] = transform(
      place(
        dataFactory.quad(
          maastricht,
          schema('latitude'),
          dataFactory.literal('50.84833'),
        ),
        dataFactory.quad(maastricht, schema('geo'), geo),
        dataFactory.quad(
          geo,
          schema('addressCountry'),
          dataFactory.literal('NL'),
        ),
      ),
    );

    expect(term.place?.latitude).toEqual(50.84833);
    expect(term.place?.addressCountry).toEqual('NL');
  });

  it('does not return the schema:geo node as a term of its own', () => {
    // It is not a skos:Concept, so it is a node the transformer reads through, never a result.
    const terms = transform(
      place(
        dataFactory.quad(maastricht, schema('geo'), geo),
        dataFactory.quad(geo, rdf.type, schema('GeoCoordinates')),
      ),
    );

    expect(terms).toHaveLength(1);
    expect(terms[0].id.value).toEqual(maastricht.value);
  });

  it('names an additional type from either predicate a vocabulary uses, without repeating one', () => {
    const populatedPlace = dataFactory.namedNode(
      'https://www.geonames.org/ontology#P.PPL',
    );
    const [term] = transform(
      place(
        dataFactory.quad(maastricht, schema('additionalType'), populatedPlace),
        dataFactory.quad(
          populatedPlace,
          skos('prefLabel'),
          dataFactory.literal('Plaats', 'nl'),
        ),
        dataFactory.quad(
          populatedPlace,
          schema('name'),
          dataFactory.literal('Populated place', 'en'),
        ),
        // The same name under both predicates, which must not be returned twice.
        dataFactory.quad(
          populatedPlace,
          schema('name'),
          dataFactory.literal('Plaats', 'nl'),
        ),
      ),
    );

    expect(term.place?.additionalTypes).toHaveLength(1);
    expect(term.place?.additionalTypes[0].id.value).toEqual(
      populatedPlace.value,
    );
    expect(
      term.place?.additionalTypes[0].prefLabels.map((name) => name.value),
    ).toEqual(['Plaats', 'Populated place']);
  });

  it('returns an additional type whose vocabulary names nothing', () => {
    const lake = dataFactory.namedNode(
      'https://www.geonames.org/ontology#H.LK',
    );
    const [term] = transform(
      place(dataFactory.quad(maastricht, schema('additionalType'), lake)),
    );

    expect(term.place?.additionalTypes[0].id.value).toEqual(lake.value);
    expect(term.place?.additionalTypes[0].prefLabels).toEqual([]);
  });

  it('collects every schema:name the source states', () => {
    const [term] = transform(
      place(
        dataFactory.quad(
          maastricht,
          schema('name'),
          dataFactory.literal('Maastricht', 'nl'),
        ),
        dataFactory.quad(
          maastricht,
          schema('name'),
          dataFactory.literal('Maestricht', 'en'),
        ),
      ),
    );

    expect(term.place?.names.map((name) => name.value)).toEqual([
      'Maastricht',
      'Maestricht',
    ]);
  });

  describe('for a person', () => {
    const rembrandt = dataFactory.namedNode('https://example.com/rembrandt');
    const leiden = dataFactory.namedNode('https://example.com/places/leiden');
    const person = (...quads: RDF.Quad[]) => [
      dataFactory.quad(rembrandt, rdf.type, skos('Concept')),
      dataFactory.quad(rembrandt, rdf.type, schema('Person')),
      ...quads,
    ];

    it('passes birth and death dates through as the source states them', () => {
      const [term] = transform(
        person(
          dataFactory.quad(
            rembrandt,
            schema('birthDate'),
            dataFactory.literal(
              '1606-07-15/1607',
              dataFactory.namedNode('http://id.loc.gov/datatypes/edtf/EDTF'),
            ),
          ),
          dataFactory.quad(
            rembrandt,
            schema('deathDate'),
            dataFactory.literal('1669-10-04'),
          ),
        ),
      );

      expect(term.person?.birthDates).toEqual(['1606-07-15/1607']);
      expect(term.person?.deathDates).toEqual(['1669-10-04']);
    });

    it('collects the given and family names a source states apart', () => {
      const [term] = transform(
        person(
          dataFactory.quad(
            rembrandt,
            schema('givenName'),
            dataFactory.literal('Rembrandt'),
          ),
          dataFactory.quad(
            rembrandt,
            schema('familyName'),
            dataFactory.literal('van Rijn'),
          ),
        ),
      );

      expect(term.person?.givenNames.map((name) => name.value)).toEqual([
        'Rembrandt',
      ]);
      expect(term.person?.familyNames.map((name) => name.value)).toEqual([
        'van Rijn',
      ]);
    });

    it('names a place referred to by IRI from the names its source gives it', () => {
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('birthPlace'), leiden),
          dataFactory.quad(
            leiden,
            schema('name'),
            dataFactory.literal('Leiden (stad)', 'nl'),
          ),
          dataFactory.quad(
            leiden,
            skos('prefLabel'),
            dataFactory.literal('Leiden (city)', 'en'),
          ),
        ),
      );

      expect(term.person?.birthPlaces).toHaveLength(1);
      expect(term.person?.birthPlaces[0].iri?.value).toEqual(leiden.value);
      expect(
        term.person?.birthPlaces[0].names.map((name) => name.value),
      ).toEqual(['Leiden (city)', 'Leiden (stad)']);
    });

    it('reads what the source only names as an entity without an IRI', () => {
      const [term] = transform(
        person(
          dataFactory.quad(
            rembrandt,
            schema('hasOccupation'),
            dataFactory.literal('schilder', 'nl'),
          ),
          dataFactory.quad(
            rembrandt,
            schema('hasOccupation'),
            dataFactory.literal('painter', 'en'),
          ),
          dataFactory.quad(
            rembrandt,
            schema('nationality'),
            dataFactory.literal('Noord-Nederlands', 'nl'),
          ),
          dataFactory.quad(
            rembrandt,
            schema('deathPlace'),
            dataFactory.literal('Amsterdam'),
          ),
        ),
      );

      // An occupation the source only names is a role named by it, without a period.
      expect(term.person?.occupations.map((role) => role.occupation)).toEqual([
        undefined,
        undefined,
      ]);
      expect(
        term.person?.occupations.map((role) => role.roleNames[0].value),
      ).toEqual(['schilder', 'painter']);
      expect(term.person?.occupations[0].startDate).toBeUndefined();
      expect(term.person?.nationalities[0].iri).toBeUndefined();
      expect(
        term.person?.nationalities[0].names.map((name) => name.value),
      ).toEqual(['Noord-Nederlands']);
      expect(term.person?.deathPlaces[0].names[0].value).toEqual('Amsterdam');
    });

    it('normalises a binary gender to the https Schema.org namespace', () => {
      const [term] = transform(
        person(
          dataFactory.quad(
            rembrandt,
            dataFactory.namedNode('http://schema.org/gender'),
            dataFactory.namedNode('http://schema.org/Male'),
          ),
        ),
      );

      expect(term.person?.genders).toHaveLength(1);
      expect(term.person?.genders[0].iri?.value).toEqual(
        'https://schema.org/Male',
      );
    });

    it('returns a gender stated in both Schema.org namespaces once', () => {
      const [term] = transform(
        person(
          dataFactory.quad(
            rembrandt,
            dataFactory.namedNode('http://schema.org/gender'),
            dataFactory.namedNode('http://schema.org/Female'),
          ),
          dataFactory.quad(rembrandt, schema('gender'), schema('Female')),
        ),
      );

      expect(term.person?.genders.map((gender) => gender.iri?.value)).toEqual([
        'https://schema.org/Female',
      ]);
    });

    it('passes any other gender through as the source states it', () => {
      const nonBinary = dataFactory.namedNode(
        'http://www.wikidata.org/entity/Q48270',
      );
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('gender'), nonBinary),
          dataFactory.quad(
            nonBinary,
            schema('name'),
            dataFactory.literal('non-binary', 'en'),
          ),
          dataFactory.quad(
            rembrandt,
            schema('gender'),
            dataFactory.literal('vrouw', 'nl'),
          ),
        ),
      );

      expect(term.person?.genders.map((gender) => gender.iri?.value)).toEqual([
        nonBinary.value,
        undefined,
      ]);
      expect(
        term.person?.genders.map((gender) =>
          gender.names.map((name) => name.value),
        ),
      ).toEqual([['non-binary'], ['vrouw']]);
    });

    it('reads family members as the persons the source names them', () => {
      const saskia = dataFactory.namedNode('https://example.com/saskia');
      const titus = dataFactory.namedNode('https://example.com/titus');
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('spouse'), saskia),
          dataFactory.quad(
            saskia,
            schema('name'),
            dataFactory.literal('Saskia van Uylenburgh'),
          ),
          dataFactory.quad(
            rembrandt,
            dataFactory.namedNode('http://schema.org/children'),
            titus,
          ),
          dataFactory.quad(
            titus,
            skos('prefLabel'),
            dataFactory.literal('Titus van Rijn'),
          ),
          // A sentence about a relative names no person, so it is not one.
          dataFactory.quad(
            rembrandt,
            schema('spouse'),
            dataFactory.literal('vanaf 1634, echtgenoot van: Saskia'),
          ),
        ),
      );

      expect(term.person?.spouses.map((spouse) => spouse.id.value)).toEqual([
        saskia.value,
      ]);
      expect(term.person?.spouses[0].prefLabels[0].value).toEqual(
        'Saskia van Uylenburgh',
      );
      expect(
        term.person?.children.map((child) => child.prefLabels[0].value),
      ).toEqual(['Titus van Rijn']);
      expect(term.person?.parents).toEqual([]);
      expect(term.person?.siblings).toEqual([]);
    });

    it('follows a schema:Role node to the relative', () => {
      const role = dataFactory.namedNode(
        'https://example.com/rembrandt#spouse',
      );
      const saskia = dataFactory.namedNode('https://example.com/saskia');
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('spouse'), role),
          dataFactory.quad(role, rdf.type, schema('Role')),
          dataFactory.quad(role, schema('spouse'), saskia),
          dataFactory.quad(
            role,
            schema('roleName'),
            dataFactory.literal('Predecessor'),
          ),
          dataFactory.quad(
            saskia,
            schema('name'),
            dataFactory.literal('Saskia van Uylenburgh'),
          ),
        ),
      );

      expect(term.person?.spouses.map((spouse) => spouse.id.value)).toEqual([
        saskia.value,
      ]);
    });

    it('reads an occupation the source identifies as a role without a period', () => {
      const painter = dataFactory.namedNode(
        'https://example.com/occupations/painter',
      );
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('hasOccupation'), painter),
          dataFactory.quad(
            painter,
            schema('name'),
            dataFactory.literal('schilder', 'nl'),
          ),
        ),
      );

      expect(term.person?.occupations).toHaveLength(1);
      expect(term.person?.occupations[0].occupation?.id.value).toEqual(
        painter.value,
      );
      expect(
        term.person?.occupations[0].occupation?.prefLabels[0].value,
      ).toEqual('schilder');
      expect(term.person?.occupations[0].roleNames).toEqual([]);
    });

    it('reads a schema:Role node for its occupation, name and period', () => {
      const role = dataFactory.namedNode('https://example.com/rembrandt#role');
      const collector = dataFactory.namedNode(
        'https://example.com/occupations/collector',
      );
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('hasOccupation'), role),
          dataFactory.quad(role, rdf.type, schema('Role')),
          // The property is repeated on the role to reach the occupation, per Schema.org.
          dataFactory.quad(role, schema('hasOccupation'), collector),
          dataFactory.quad(
            role,
            schema('roleName'),
            dataFactory.literal('verzamelaar', 'nl'),
          ),
          dataFactory.quad(
            role,
            schema('startDate'),
            dataFactory.literal('1625'),
          ),
          dataFactory.quad(
            role,
            schema('endDate'),
            dataFactory.literal('1669'),
          ),
          dataFactory.quad(
            collector,
            schema('name'),
            dataFactory.literal('kunstverzamelaar', 'nl'),
          ),
        ),
      );

      expect(term.person?.occupations).toHaveLength(1);
      const [dated] = term.person?.occupations ?? [];
      expect(dated.occupation?.id.value).toEqual(collector.value);
      expect(dated.occupation?.prefLabels[0].value).toEqual('kunstverzamelaar');
      expect(dated.roleNames[0].value).toEqual('verzamelaar');
      expect(dated.startDate).toEqual('1625');
      expect(dated.endDate).toEqual('1669');
      // The role node is not a term of its own.
      expect(
        transform(
          person(
            dataFactory.quad(rembrandt, schema('hasOccupation'), role),
            dataFactory.quad(role, rdf.type, schema('Role')),
          ),
        ).map((term) => term.id.value),
      ).toEqual([rembrandt.value]);
    });

    it('names a role by the occupation literal on the role node', () => {
      const role = dataFactory.namedNode('https://example.com/rembrandt#role');
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('hasOccupation'), role),
          dataFactory.quad(role, rdf.type, schema('Role')),
          dataFactory.quad(
            role,
            schema('hasOccupation'),
            dataFactory.literal('schilder', 'nl'),
          ),
          dataFactory.quad(
            role,
            schema('startDate'),
            dataFactory.literal('1625'),
          ),
        ),
      );

      expect(term.person?.occupations).toHaveLength(1);
      expect(term.person?.occupations[0].occupation).toBeUndefined();
      expect(
        term.person?.occupations[0].roleNames.map((name) => name.value),
      ).toEqual(['schilder']);
      expect(term.person?.occupations[0].startDate).toEqual('1625');
    });

    it('reads a schema:Role node stated as a blank node', () => {
      const role = dataFactory.blankNode('role');
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('hasOccupation'), role),
          dataFactory.quad(role, rdf.type, schema('Role')),
          dataFactory.quad(
            role,
            schema('roleName'),
            dataFactory.literal('werkzaam', 'nl'),
          ),
          dataFactory.quad(
            role,
            schema('endDate'),
            dataFactory.literal('1669'),
          ),
        ),
      );

      expect(term.person?.occupations).toHaveLength(1);
      expect(term.person?.occupations[0].roleNames[0].value).toEqual(
        'werkzaam',
      );
      expect(term.person?.occupations[0].endDate).toEqual('1669');
    });

    it('drops a schema:Role node that neither names nor identifies what the person did', () => {
      const role = dataFactory.namedNode('https://example.com/rembrandt#role');
      const [term] = transform(
        person(
          dataFactory.quad(rembrandt, schema('hasOccupation'), role),
          dataFactory.quad(role, rdf.type, schema('Role')),
          dataFactory.quad(
            role,
            schema('startDate'),
            dataFactory.literal('1625'),
          ),
        ),
      );

      // A period alone is no role, and with nothing else stated there is no person.
      expect(term.person).toBeUndefined();
    });

    it('drops a reference the source states as a blank node', () => {
      const [term] = transform(
        person(
          dataFactory.quad(
            rembrandt,
            schema('birthPlace'),
            dataFactory.blankNode('somewhere'),
          ),
        ),
      );

      // A blank node is no place, and with nothing else stated there is no person.
      expect(term.person).toBeUndefined();
    });

    it('does not return a referred-to place as a term of its own', () => {
      const terms = transform(
        person(
          dataFactory.quad(rembrandt, schema('birthPlace'), leiden),
          dataFactory.quad(
            leiden,
            schema('name'),
            dataFactory.literal('Leiden', 'nl'),
          ),
        ),
      );

      expect(terms.map((term) => term.id.value)).toEqual([rembrandt.value]);
    });
  });

  describe('for an organization', () => {
    const ceramique = dataFactory.namedNode('https://example.com/ceramique');
    const maastrichtCity = dataFactory.namedNode(
      'https://example.com/places/maastricht',
    );
    const organization = (...quads: RDF.Quad[]) => [
      dataFactory.quad(ceramique, rdf.type, skos('Concept')),
      dataFactory.quad(ceramique, rdf.type, schema('Organization')),
      ...quads,
    ];

    it('returns no organization for one whose source states nothing about it', () => {
      const [term] = transform(organization());

      expect(term.organization).toBeUndefined();
    });

    it('returns no organization for a term that denotes something else', () => {
      const [term] = transform(
        place(
          dataFactory.quad(
            maastricht,
            schema('foundingDate'),
            dataFactory.literal('1863'),
          ),
        ),
      );

      expect(term.organization).toBeUndefined();
    });

    it('passes founding and dissolution dates through as the source states them', () => {
      const [term] = transform(
        organization(
          dataFactory.quad(
            ceramique,
            // In the http namespace, as the KB states it.
            dataFactory.namedNode('http://schema.org/foundingDate'),
            dataFactory.literal(
              '1863',
              dataFactory.namedNode('http://www.w3.org/2001/XMLSchema#gYear'),
            ),
          ),
          dataFactory.quad(
            ceramique,
            schema('dissolutionDate'),
            dataFactory.literal('1958'),
          ),
        ),
      );

      expect(term.organization?.foundingDates).toEqual(['1863']);
      expect(term.organization?.dissolutionDates).toEqual(['1958']);
    });

    it('names its kinds and parent organizations from the names its source gives them', () => {
      const factory = dataFactory.namedNode(
        'https://example.com/types/factory',
      );
      const parent = dataFactory.namedNode('https://example.com/regout');
      const [term] = transform(
        organization(
          dataFactory.quad(ceramique, schema('additionalType'), factory),
          dataFactory.quad(
            factory,
            schema('name'),
            dataFactory.literal('aardewerkfabriek', 'nl'),
          ),
          dataFactory.quad(ceramique, schema('parentOrganization'), parent),
          dataFactory.quad(
            parent,
            skos('prefLabel'),
            dataFactory.literal('Petrus Regout & Co.'),
          ),
          // A parent the source only names identifies no organization.
          dataFactory.quad(
            ceramique,
            schema('parentOrganization'),
            dataFactory.literal('Gemeente Maastricht'),
          ),
        ),
      );

      expect(term.organization?.additionalTypes).toHaveLength(1);
      expect(term.organization?.additionalTypes[0].id).toEqual(factory);
      expect(term.organization?.additionalTypes[0].prefLabels[0].value).toEqual(
        'aardewerkfabriek',
      );
      expect(term.organization?.parentOrganizations).toHaveLength(1);
      expect(term.organization?.parentOrganizations[0].id).toEqual(parent);
      expect(
        term.organization?.parentOrganizations[0].prefLabels[0].value,
      ).toEqual('Petrus Regout & Co.');
    });

    it('reads a location the source links as a named place', () => {
      const [term] = transform(
        organization(
          dataFactory.quad(ceramique, schema('location'), maastrichtCity),
          dataFactory.quad(
            maastrichtCity,
            schema('name'),
            dataFactory.literal('Maastricht (stad)', 'nl'),
          ),
        ),
      );

      expect(term.organization?.locations).toHaveLength(1);
      expect(term.organization?.locations[0].iri).toEqual(maastrichtCity);
      expect(term.organization?.locations[0].names[0].value).toEqual(
        'Maastricht (stad)',
      );
      expect(term.organization?.locations[0].addressCountry).toBeUndefined();
    });

    it('reads a location the source only names as a name alone', () => {
      const [term] = transform(
        organization(
          dataFactory.quad(
            ceramique,
            schema('location'),
            dataFactory.literal('Maastricht', 'nl'),
          ),
        ),
      );

      expect(term.organization?.locations).toHaveLength(1);
      expect(term.organization?.locations[0].iri).toBeUndefined();
      expect(term.organization?.locations[0].names[0].value).toEqual(
        'Maastricht',
      );
    });

    it('reads an address the source states only as text, once however often it is stated', () => {
      // The KB mints an IRI per address that identifies nothing outside it.
      const address = (id: string, locality?: string) => {
        const node = dataFactory.namedNode(
          `https://example.com/.well-known/genid/${id}`,
        );
        return [
          dataFactory.quad(ceramique, schema('location'), node),
          dataFactory.quad(node, rdf.type, schema('PostalAddress')),
          ...(locality === undefined
            ? []
            : [
                dataFactory.quad(
                  node,
                  schema('addressLocality'),
                  dataFactory.literal(locality),
                ),
              ]),
          dataFactory.quad(
            node,
            schema('addressCountry'),
            dataFactory.literal('NL'),
          ),
        ];
      };
      const [term] = transform(
        organization(
          ...address('street', 'Den Haag'),
          ...address('postbus', 'Den Haag'),
          ...address('country'),
          // A node that states neither a name nor a country locates nothing.
          dataFactory.quad(
            ceramique,
            schema('location'),
            dataFactory.blankNode('empty'),
          ),
          // A blank node is an address too, read for its name where it states no locality.
          dataFactory.quad(
            ceramique,
            schema('location'),
            dataFactory.blankNode('named'),
          ),
          dataFactory.quad(
            dataFactory.blankNode('named'),
            schema('name'),
            dataFactory.literal('Brussel', 'nl'),
          ),
        ),
      );

      expect(
        term.organization?.locations.map((location) => ({
          iri: location.iri,
          names: location.names.map((name) => name.value),
          addressCountry: location.addressCountry,
        })),
      ).toEqual([
        { iri: undefined, names: ['Den Haag'], addressCountry: 'NL' },
        { iri: undefined, names: [], addressCountry: 'NL' },
        { iri: undefined, names: ['Brussel'], addressCountry: undefined },
      ]);
    });

    it('reads its periods of activity as events, ordered by when they began', () => {
      const active = dataFactory.namedNode(
        'https://example.com/ceramique/period-of-activity/',
      );
      const activeInMaastricht = dataFactory.namedNode(
        'https://example.com/ceramique/occupation/1',
      );
      const [term] = transform(
        organization(
          dataFactory.quad(ceramique, schema('event'), active),
          dataFactory.quad(active, rdf.type, schema('Event')),
          dataFactory.quad(
            active,
            schema('startDate'),
            dataFactory.literal('1863'),
          ),
          dataFactory.quad(
            active,
            schema('endDate'),
            dataFactory.literal('1958'),
          ),
          dataFactory.quad(ceramique, schema('event'), activeInMaastricht),
          dataFactory.quad(activeInMaastricht, rdf.type, schema('Event')),
          dataFactory.quad(
            activeInMaastricht,
            schema('startDate'),
            dataFactory.literal('1850'),
          ),
          dataFactory.quad(
            activeInMaastricht,
            schema('location'),
            maastrichtCity,
          ),
          dataFactory.quad(
            maastrichtCity,
            schema('name'),
            dataFactory.literal('Maastricht (stad)', 'nl'),
          ),
          // A period that states neither when nor where says nothing.
          dataFactory.quad(
            ceramique,
            schema('event'),
            dataFactory.namedNode('https://example.com/ceramique/nothing'),
          ),
          dataFactory.quad(
            dataFactory.namedNode('https://example.com/ceramique/nothing'),
            rdf.type,
            schema('Event'),
          ),
          // So does an event the source states as a literal.
          dataFactory.quad(
            ceramique,
            schema('event'),
            dataFactory.literal('fuseerde in 1958'),
          ),
        ),
      );

      expect(
        term.organization?.events.map((event) => ({
          startDate: event.startDate,
          endDate: event.endDate,
          locations: event.locations.map((location) => location.iri?.value),
        })),
      ).toEqual([
        {
          startDate: '1850',
          endDate: undefined,
          locations: [maastrichtCity.value],
        },
        { startDate: '1863', endDate: '1958', locations: [] },
      ]);
    });

    it('sorts an event without a start date last', () => {
      const event = (id: string, endDate: string, startDate?: string) => {
        const node = dataFactory.blankNode(id);
        return [
          dataFactory.quad(ceramique, schema('event'), node),
          ...(startDate === undefined
            ? []
            : [
                dataFactory.quad(
                  node,
                  schema('startDate'),
                  dataFactory.literal(startDate),
                ),
              ]),
          dataFactory.quad(
            node,
            schema('endDate'),
            dataFactory.literal(endDate),
          ),
        ];
      };
      const [term] = transform(
        organization(
          ...event('undated', '1925'),
          ...event('later', '1958', '1863'),
          // Two that began in the same year keep the order the source states them in.
          ...event('tied', '1900', '1863'),
          ...event('earlier', '1859', '1850'),
          ...event('also-undated', '2020'),
        ),
      );

      expect(term.organization?.events.map((event) => event.endDate)).toEqual([
        '1859',
        '1958',
        '1900',
        '1925',
        '2020',
      ]);
    });

    it('does not return a location or an event as a term of its own', () => {
      const event = dataFactory.namedNode(
        'https://example.com/ceramique#event',
      );
      const terms = transform(
        organization(
          dataFactory.quad(ceramique, schema('location'), maastrichtCity),
          dataFactory.quad(ceramique, schema('event'), event),
          dataFactory.quad(event, rdf.type, schema('Event')),
          dataFactory.quad(event, schema('location'), maastrichtCity),
        ),
      );

      expect(terms.map((term) => term.id.value)).toEqual([ceramique.value]);
    });
  });
});
