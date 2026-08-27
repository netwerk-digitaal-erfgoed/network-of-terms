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
});
