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

    expect(term.latitude?.value).toEqual('50.84833');
    expect(term.longitude?.value).toEqual('5.68889');
    expect(term.addressCountry?.value).toEqual('NL');
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

    expect(term.latitude?.value).toEqual('50.84833');
    expect(term.addressCountry).toBeUndefined();
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

    expect(term.latitude?.value).toEqual('50.84833');
    expect(term.addressCountry?.value).toEqual('NL');
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

    expect(term.additionalTypes).toHaveLength(1);
    expect(term.additionalTypes[0].id.value).toEqual(populatedPlace.value);
    expect(
      term.additionalTypes[0].prefLabels.map((name) => name.value),
    ).toEqual(['Plaats', 'Populated place']);
  });

  it('returns an additional type whose vocabulary names nothing', () => {
    const lake = dataFactory.namedNode(
      'https://www.geonames.org/ontology#H.LK',
    );
    const [term] = transform(
      place(dataFactory.quad(maastricht, schema('additionalType'), lake)),
    );

    expect(term.additionalTypes[0].id.value).toEqual(lake.value);
    expect(term.additionalTypes[0].prefLabels).toEqual([]);
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

    expect(term.names.map((name) => name.value)).toEqual([
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

      expect(term.birthDates.map((date) => date.value)).toEqual([
        '1606-07-15/1607',
      ]);
      expect(term.birthDates[0].datatype.value).toEqual(
        'http://id.loc.gov/datatypes/edtf/EDTF',
      );
      expect(term.deathDates.map((date) => date.value)).toEqual(['1669-10-04']);
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

      expect(term.birthPlaces).toHaveLength(1);
      expect(term.birthPlaces[0].iri?.value).toEqual(leiden.value);
      expect(term.birthPlaces[0].names.map((name) => name.value)).toEqual([
        'Leiden (city)',
        'Leiden (stad)',
      ]);
    });

    it('keeps a reference by name alone as a reference without an IRI', () => {
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

      expect(term.occupations.map((occupation) => occupation.iri)).toEqual([
        undefined,
        undefined,
      ]);
      expect(
        term.occupations.map((occupation) => occupation.names[0].value),
      ).toEqual(['schilder', 'painter']);
      expect(term.nationalities[0].names[0].value).toEqual('Noord-Nederlands');
      expect(term.deathPlaces[0].names[0].value).toEqual('Amsterdam');
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

      expect(term.birthPlaces).toEqual([]);
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
});
