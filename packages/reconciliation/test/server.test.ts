import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryTermsService } from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { server } from '../src/server.js';
import { ReconciliationQueryBatch } from '../src/query.js';
import {
  startDistributionSparqlEndpoint,
  testCatalog,
  teardown,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query/test-utils';
import {
  DataExtensionQuery,
  dataExtensionProperties,
} from '../src/data-extension.js';
import { config } from '../src/config.js';
import {
  conceptType,
  organizationType,
  personType,
  placeType,
} from '../src/types.js';
import { escapeHtml } from '@hapi/hoek';
import { SpecSchema, specViolations } from './spec.js';

let httpServer: FastifyInstance;
const catalog = testCatalog(3001);
describe('Server', () => {
  afterAll(async () => {
    await teardown();
  }, 40_000);

  beforeAll(async () => {
    await startDistributionSparqlEndpoint(3001);
    httpServer = await server(catalog, config);
  }, 40_000);

  it('returns ok at root', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile',
    });
    expect(response.statusCode).toEqual(200);
  });

  it('returns reconciliation service manifest', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/https://data.rkd.nl/rkdartists',
    });
    expect(response.statusCode).toEqual(200);
    expectSpecCompliant(response, 'manifest');
  });

  it('returns reconciliation service manifest with backwards compatible distribution URI', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
    });
    expect(response.statusCode).toEqual(200);
  });

  // Reverse proxies such as Traefik merge the double slash after the scheme.
  it('returns reconciliation service manifest when a proxy merged the slashes in the IRI', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/https:/data.rkd.nl/rkdartists',
    });
    expect(response.statusCode).toEqual(200);
  });

  it('returns 404 if reconciliation service does not exist', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/http://nope.com',
    });
    expect(response.statusCode).toEqual(404);

    // This distribution exists, but does not have reconciliation enabled.
    const notFoundResponse = await reconciliationQuery(
      'https://example.com/distributions/timeout',
    );
    expect(notFoundResponse.statusCode).toEqual(404);
  });

  it('responds to successful reconciliation API requests', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);

    expect(results.q1.result).toEqual([
      {
        id: 'https://example.com/resources/artwork',
        name: 'Nachtwacht',
        type: [conceptType],
        score: 100,
        description: 'Nachtwacht alt',
      },
    ]);

    // Results must be sorted by score in decreasing order.
    expect(results.q2.result).toHaveLength(2);
    expect(results.q2.result[0].name).toEqual('Kunstige dingen');
    expect(results.q2.result[0].score).toEqual(62.5); // Match of ‘things’ in prefLabel ‘All things art’.
    expect(results.q2.result[1].description).toEqual(
      'mooie geschilderde dingen • en nog meer',
    ); // Result has no prefLabel.
    expect(results.q2.result[1].score).toEqual(28.57); // Match of ‘things’ in altLabel ‘painted things that can be beautiful’.

    expect(results.q3.result).toEqual([]); // No results.
  });

  it('reconciles against the type the client sends', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      {
        any: { query: 'rembrandt' },
        person: { query: 'rembrandt', type: personType.id },
        all: {
          query: 'rembrandt',
          type: [conceptType.id, personType.id],
          type_strict: 'all',
        },
        should: {
          query: 'rembrandt',
          type: 'https://example.com/Unknown',
          type_strict: 'should',
        },
      },
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    const ids = (queryId: string) =>
      results[queryId].result.map((candidate: { id: string }) => candidate.id);

    // The painter is a concept that the source does not type as a person.
    expect(ids('any')).toEqual([
      'https://example.com/resources/painter',
      'https://example.com/resources/rembrandt',
    ]);
    expect(results.any.result[0].type).toEqual([conceptType]);
    expect(results.any.result[1].type).toEqual([personType, conceptType]);
    expect(ids('person')).toEqual(['https://example.com/resources/rembrandt']);
    expect(ids('all')).toEqual(ids('person'));
    expect(ids('should')).toEqual(ids('any'));
    // The queries run one after another, each against the test source.
  }, 40_000);

  it('describes a person candidate by birth and death dates', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      { q1: { query: 'rembrandt' } },
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);

    expect(
      results.q1.result.find(
        (candidate: { id: string }) =>
          candidate.id === 'https://example.com/resources/rembrandt',
      ).description,
    ).toEqual('1606-07-15/1607 – 1669-10-04 • Rembrandt van Rijn');
  });

  it('ranks candidates on the properties a query sends', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      {
        born: {
          query: 'rembrandt',
          properties: [
            { pid: 'birthDates', v: '1607' },
            { pid: 'birthPlaces', v: 'Leiden' },
          ],
        },
        bornElsewhen: {
          query: 'rembrandt',
          properties: [{ pid: 'birthDates', v: '1700' }],
        },
        fullName: {
          query: 'rembrandt van rijn',
          properties: [{ pid: 'birthDates', v: '1607' }],
        },
      },
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);

    // The person’s name, birth date and birthplace all match, which singles them out.
    const [first, second] = results.born.result;
    expect(first).toMatchObject({
      id: 'https://example.com/resources/rembrandt',
      score: 100,
      match: true,
      features: [
        { id: 'name', value: 1 },
        { id: 'birthDates', value: 1 },
        { id: 'birthPlaces', value: 1 },
      ],
    });
    // A namesake whose source states neither ranks below, and its features say only the name was
    // compared.
    expect(second.score).toBeLessThan(100);
    expect(second.features).toEqual([{ id: 'name', value: 1 }]);
    expect(second.match).toBeUndefined();

    // A birth date that contradicts the person’s ranks them below the namesake the source states
    // nothing about.
    const contradicted = results.bornElsewhen.result.find(
      (candidate: { id: string }) =>
        candidate.id === 'https://example.com/resources/rembrandt',
    );
    expect(contradicted.features).toContainEqual({
      id: 'birthDates',
      value: 0,
    });
    expect(results.bornElsewhen.result[0].id).not.toEqual(
      'https://example.com/resources/rembrandt',
    );
    expect(results.bornElsewhen.result[0].match).toBeUndefined();

    // The only candidate is the match when everything the query sends matches.
    expect(results.fullName.result).toHaveLength(1);
    expect(results.fullName.result[0].match).toEqual(true);
  });

  it('fetches more candidates to rank on properties only from a source of persons', async () => {
    const search = vi.spyOn(QueryTermsService.prototype, 'search');
    const properties = [{ pid: 'birthDates', v: '1607' }];
    await reconciliationQuery('https://data.rkd.nl/rkdartists', {
      q1: { query: 'rembrandt', properties },
    });
    await reconciliationQuery('https://data.cultureelerfgoed.nl/term/id/cht', {
      q1: { query: 'kunst', properties },
    });
    expect(search.mock.calls.map((call) => call[4])).toEqual([1000, 100]);
    search.mockRestore();
  });

  it('validates the properties of reconciliation requests', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      {
        q1: {
          query: 'rembrandt',
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore a property without a value on purpose.
          properties: [{ pid: 'birthDates' }],
        },
      },
    );
    expect(response.statusCode).toEqual(400);

    // Candidates are found by name, so properties alone are not a query.
    const withoutName = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore a query without a name on purpose.
        q1: { properties: [{ pid: 'birthDates', v: '1607' }] },
      },
    );
    expect(withoutName.statusCode).toEqual(400);
  });

  it('declares the property suggest service in the manifest', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/reconcile/https://data.rkd.nl/rkdartists',
    });
    expect(JSON.parse(response.body).suggest).toEqual({
      property: {
        service_url: 'http://localhost',
        service_path: '/suggest/property',
      },
    });
  });

  it('suggests the properties a query can send, by ID or translated name', async () => {
    const all = await httpServer.inject({
      method: 'GET',
      url: '/suggest/property',
    });
    expect(JSON.parse(all.body).result).toHaveLength(13);
    expectSpecCompliant(all, 'suggest-properties-response');

    const dutch = await httpServer.inject({
      method: 'GET',
      url: '/suggest/property?prefix=Geb',
      headers: { 'accept-language': 'nl' },
    });
    expect(JSON.parse(dutch.body).result).toEqual([
      { id: 'birthDates', name: 'Geboortedatum' },
      { id: 'birthPlaces', name: 'Geboorteplaats' },
    ]);

    const english = await httpServer.inject({
      method: 'GET',
      url: '/suggest/property?prefix=death',
      headers: { 'accept-language': 'en' },
    });
    expect(JSON.parse(english.body).result).toEqual([
      { id: 'deathDates', name: 'Date of death' },
      { id: 'deathPlaces', name: 'Place of death' },
    ]);

    const repeated = await httpServer.inject({
      method: 'GET',
      url: '/suggest/property?prefix=a&prefix=b',
    });
    expect(repeated.statusCode).toEqual(400);
  });

  it('responds to successful reconciliation API request with backwards compatible distribution URI', async () => {
    const response = await reconciliationQuery(
      'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);

    expect(results.q1.result).toEqual([
      {
        id: 'https://example.com/resources/artwork',
        name: 'Nachtwacht',
        type: [conceptType],
        score: 100,
        description: 'Nachtwacht alt',
      },
    ]);
  });

  it('limits reconciliation API results', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      {
        q1: {
          query: 'art',
        },
        q2: {
          query: 'art',
          limit: 1,
        },
      },
    );
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.q1.result).toHaveLength(2);
    expect(results.q2.result).toHaveLength(1);
  });

  it('validates reconciliation requests', async () => {
    const response = await reconciliationQuery(
      'https://data.rkd.nl/rkdartists',
      {
        q1: {
          query: 'art',
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore string on purpose where a number should be.
          limit: 'not a valid a limit',
        },
      },
    );
    expect(response.statusCode).toEqual(400);
    expect(JSON.parse(response.body).message).toEqual(
      "body/q1/limit must be integer, body must have required property 'ids', body must match a schema in anyOf",
    );
  });

  it('handles source timeouts for reconciliation requests', async () => {
    const response = await reconciliationQuery(
      'https://example.com/distributions/endpoint-error',
    );
    expect(response.statusCode).toEqual(200);
  });

  it('returns data extension properties', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/extend/propose',
    });
    expect(response.statusCode).toEqual(200);
    expectSpecCompliant(response, 'data-extension-property-proposal');
  });

  it('accepts a data extension query form-encoded in an ‘extend’ parameter, as OpenRefine sends it', async () => {
    const formResponse = await httpServer.inject({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      url: '/reconcile/https://data.rkd.nl/rkdartists',
      payload: new URLSearchParams([
        [
          'extend',
          JSON.stringify({
            ids: ['https://example.com/resources/artwork'],
            properties: [{ id: 'prefLabels' }],
          }),
        ],
      ]).toString(),
    });
    expect(formResponse.statusCode).toEqual(200);
    expect(
      JSON.parse(formResponse.body).rows[
        'https://example.com/resources/artwork'
      ],
    ).toEqual({ prefLabels: [{ str: 'Nachtwacht' }] });
  });

  it('returns data extension response for terms', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      language: 'en',
    });
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);

    // This is what OpenRefine currently expects.
    const response2 = await dataExtensionQuery({
      url: '/reconcile/https://data.rkd.nl/rkdartists/extend',
    });
    expect(response2.statusCode).toEqual(200);
    const results2 = JSON.parse(response.body);

    expect(results).toEqual(results2);

    expect(results.meta).toContainEqual({
      id: 'relatedTerms',
      name: 'relatedTerms',
      type: {
        id: 'http://www.w3.org/2004/02/skos/core#Concept',
        name: 'Concept',
      },
    });
    expect(results.meta).toContainEqual({
      id: 'parents',
      name: 'parents',
      type: personType,
    });

    expect(results.rows).toEqual({
      'https://example.com/resources/artwork': {
        prefLabels: [{ str: 'The Night Watch' }],
        altLabels: [{ str: 'Night Watch alt' }],
        scopeNotes: [{ str: 'One of the most famous Dutch paintings' }],
        birthDates: [],
        deathDates: [],
        birthPlaces: [],
        deathPlaces: [],
        genders: [],
        givenNames: [],
        familyNames: [],
        occupations: [],
        nationalities: [],
        parents: [],
        children: [],
        spouses: [],
        siblings: [],
        placeNames: [],
        latitudes: [],
        longitudes: [],
        countries: [],
        placeTypes: [],
        broaderTerms: [{ str: 'https://example.com/resources/2' }],
        narrowerTerms: [],
        relatedTerms: [
          { str: 'https://example.com/resources/painting' },
          { id: 'https://example.com/resources/art', name: 'All things art' },
          { id: 'https://example.com/resources/painter', name: 'Rembrandt' },
        ],
        exactMatches: [{ str: 'https://example.com/resources/match' }],
        seeAlso: [{ str: 'https://example.com/html/artwork' }],
      },
      'https://example.com/resources/painter': {
        prefLabels: [{ str: 'Rembrandt' }],
        altLabels: [],
        scopeNotes: [],
        birthDates: [],
        deathDates: [],
        birthPlaces: [],
        deathPlaces: [],
        genders: [],
        givenNames: [],
        familyNames: [],
        occupations: [],
        nationalities: [],
        parents: [],
        children: [],
        spouses: [],
        siblings: [],
        placeNames: [],
        latitudes: [],
        longitudes: [],
        countries: [],
        placeTypes: [],
        broaderTerms: [],
        narrowerTerms: [],
        relatedTerms: [],
        exactMatches: [],
        seeAlso: [],
      },
    });
  });

  it('falls back to mul labels in data extension response', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      language: 'en',
      query: {
        ids: ['https://example.com/resources/photographer'],
        properties: [{ id: 'prefLabels' }],
      },
    });
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.rows).toEqual({
      'https://example.com/resources/photographer': {
        prefLabels: [{ str: 'Marion Michelle Koblitz' }],
      },
    });
  });

  it('names a related term in any language when it has no name in the requested one', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      language: 'nl',
      query: {
        ids: ['https://example.com/resources/bauhaus'],
        properties: [{ id: 'relatedTerms' }],
      },
    });
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.rows).toEqual({
      'https://example.com/resources/bauhaus': {
        relatedTerms: [
          {
            id: 'https://example.com/resources/werkbund',
            name: 'Deutscher Werkbund',
          },
        ],
      },
    });
  });

  it('returns only the requested properties in data extension response', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      query: {
        ids: ['https://example.com/resources/artwork'],
        properties: [{ id: 'exactMatches' }, { id: 'unknown' }],
      },
    });
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.meta).toEqual([
      { id: 'exactMatches', name: 'exactMatches' },
    ]);
    expect(results.rows).toEqual({
      'https://example.com/resources/artwork': {
        exactMatches: [{ str: 'https://example.com/resources/match' }],
      },
    });
  });

  it('returns what the source states about a person in data extension response', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      language: 'nl',
      query: {
        ids: ['https://example.com/resources/rembrandt'],
        properties: allProperties,
      },
    });
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(results.rows).toEqual({
      'https://example.com/resources/rembrandt': {
        prefLabels: [{ str: 'Rembrandt' }],
        altLabels: [{ str: 'Rembrandt van Rijn' }],
        scopeNotes: [],
        birthDates: [{ str: '1606-07-15/1607' }],
        deathDates: [{ str: '1669-10-04' }],
        birthPlaces: [{ str: 'Leiden (stad)' }],
        deathPlaces: [{ str: 'Amsterdam (stad)' }],
        genders: [{ str: 'https://schema.org/Male' }],
        givenNames: [{ str: 'Rembrandt' }],
        familyNames: [{ str: 'van Rijn' }],
        // Each role by its Dutch name, so the English names of the same roles are left out.
        occupations: [
          { str: 'schilder' },
          { str: 'etser' },
          { str: 'kunstverzamelaar' },
          { str: 'werkzaam' },
        ],
        nationalities: [{ str: 'Noord-Nederlands' }],
        parents: [],
        children: [
          { id: 'https://example.com/resources/titus', name: 'Titus van Rijn' },
        ],
        // The sentence about Saskia names no person, so only Saskia herself is a spouse.
        spouses: [
          {
            id: 'https://example.com/resources/saskia',
            name: 'Saskia van Uylenburgh',
          },
        ],
        siblings: [],
        placeNames: [],
        latitudes: [],
        longitudes: [],
        countries: [],
        placeTypes: [],
        broaderTerms: [],
        narrowerTerms: [],
        relatedTerms: [],
        exactMatches: [],
        seeAlso: [],
      },
    });
  });

  it('returns a place’s names, coordinates, country and types in data extension response', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      language: 'nl',
      query: {
        ids: [
          'https://example.com/resources/place',
          'https://example.com/resources/place-without-coordinates',
          'https://example.com/resources/place-without-location',
        ],
        properties: [
          { id: 'placeNames' },
          { id: 'latitudes' },
          { id: 'longitudes' },
          { id: 'countries' },
          { id: 'placeTypes' },
        ],
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.body).rows).toEqual({
      'https://example.com/resources/place': {
        placeNames: [{ str: 'Maastricht' }],
        latitudes: [{ float: 50.84833 }],
        longitudes: [{ float: 5.68889 }],
        countries: [{ str: 'NL' }],
        placeTypes: [{ str: 'hoofdplaats van een provincie' }],
      },
      // A type its vocabulary does not name is its IRI.
      'https://example.com/resources/place-without-location': {
        placeNames: [{ str: 'Rijnland' }],
        latitudes: [],
        longitudes: [],
        countries: [{ str: 'NL' }],
        placeTypes: [{ str: 'https://www.geonames.org/ontology#H.LK' }],
      },
      // The source’s coordinates and country are unusable, so the place states none.
      'https://example.com/resources/place-without-coordinates': {
        placeNames: [],
        latitudes: [],
        longitudes: [],
        countries: [],
        placeTypes: [],
      },
    });
  });

  it('returns no date for an empty date in data extension response', async () => {
    const response = await dataExtensionQuery({
      url: '/extend',
      language: 'nl',
      query: {
        ids: ['https://example.com/resources/person-empty-date'],
        properties: [{ id: 'birthDates' }],
      },
    });
    expect(response.statusCode).toEqual(200);
    const results = JSON.parse(response.body);
    expect(
      results.rows['https://example.com/resources/person-empty-date']
        .birthDates,
    ).toEqual([]);
  });

  it('shows HTML term preview, defaulting to Dutch', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/artwork',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toContain('<h1>Nachtwacht</h1>');
    expect(response.body).toMatch('One of the most famous Dutch paintings');
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Gerelateerde termen</dt>\\s*<dd>Kunstige dingen &#8226; Rembrandt</dd>',
      ),
    );
    expect(response.body).toContain('RKDartists');
  });

  it('shows birth and death of a person in HTML term preview', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/rembrandt',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Geboren</dt>\\s*<dd>1606-07-15&#x2f;1607 &#8226; Leiden &#x28;stad&#x29;</dd>',
      ),
    );
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Overleden</dt>\\s*<dd>1669-10-04 &#8226; Amsterdam &#x28;stad&#x29;</dd>',
      ),
    );
  });

  it('shows the work and family of a person in HTML term preview', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/rembrandt',
    });
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Beroep</dt>\\s*<dd>schilder &#8226; etser &#8226; kunstverzamelaar &#8226; werkzaam</dd>',
      ),
    );
    expect(response.body).toMatch(
      new RegExp('<dt>Gender</dt>\\s*<dd>man</dd>'),
    );
    expect(response.body).toMatch(
      new RegExp('<dt>Nationaliteit</dt>\\s*<dd>Noord-Nederlands</dd>'),
    );
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Echtgeno\\(o\\)t\\(e\\)</dt>\\s*<dd>Saskia van Uylenburgh</dd>',
      ),
    );
    expect(response.body).toMatch(
      new RegExp('<dt>Kinderen</dt>\\s*<dd>Titus van Rijn</dd>'),
    );
    expect(response.body).not.toContain('Ouders');
  });

  it('shows no birth or death in HTML term preview of a term that is not a person', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/artwork',
    });
    expect(response.body).not.toContain('Geboren');
    expect(response.body).not.toContain('Overleden');
    expect(response.body).not.toContain('Beroep');
  });

  it('proposes the properties of the type a column is reconciled against', async () => {
    const propose = async (type?: string) => {
      const response = await httpServer.inject({
        method: 'GET',
        url: '/extend/propose',
        query: type === undefined ? {} : { type },
      });
      expectSpecCompliant(response, 'data-extension-property-proposal');
      return JSON.parse(response.body);
    };
    const ids = (properties: { id: string }[]) =>
      properties.map((property) => property.id);

    const person = await propose(personType.id);
    expect(person.type).toEqual(personType.id);
    expect(ids(person.properties)).toContain('occupations');
    expect(ids(person.properties)).not.toContain('broaderTerms');
    expect(ids(person.properties)).not.toContain('latitudes');
    expect(person.properties).toContainEqual({
      id: 'parents',
      name: 'parents',
    });

    // A place or organization is never a person, but it may have broader and narrower terms.
    for (const type of [placeType, organizationType]) {
      const properties = ids((await propose(type.id)).properties);
      expect(properties).toContain('broaderTerms');
      expect(properties).not.toContain('birthDates');
      expect(properties).not.toContain('parents');
    }

    // Only a place column is offered a place’s properties.
    expect(ids((await propose(placeType.id)).properties)).toContain(
      'latitudes',
    );
    expect(ids((await propose(organizationType.id)).properties)).not.toContain(
      'latitudes',
    );

    // Persons are concepts too, so a concept column gets every property, as does one without type.
    const concept = await propose(conceptType.id);
    expect(ids(concept.properties)).toEqual(ids(dataExtensionProperties));
    const untyped = await propose();
    expect(untyped.type).toEqual(conceptType.id);
    expect(untyped.properties).toEqual(concept.properties);

    // A repeated type is not rejected; the first counts.
    const repeated = await httpServer.inject({
      method: 'GET',
      url: `/extend/propose?type=${encodeURIComponent(personType.id)}&type=${encodeURIComponent(conceptType.id)}`,
    });
    expect(repeated.statusCode).toEqual(200);
    expect(JSON.parse(repeated.body).type).toEqual(personType.id);

    // A type named like a property of every object is just a type the service does not know.
    const inherited = await propose('constructor');
    expect(ids(inherited.properties)).toEqual(ids(dataExtensionProperties));
  });

  it('shows HTML term preview when a proxy merged the slashes in the IRI', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https:/example.com/resources/artwork',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toContain('<h1>Nachtwacht</h1>');
  });

  it('shows HTML term preview if term has no altLabels', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/painter',
      headers: {
        'accept-language': 'de', // Should default to nl.
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toContain(
      `<a target="_blank" href="${escapeHtml(
        'https://termennetwerk.netwerkdigitaalerfgoed.nl/lookup?uri=https%3A%2F%2Fexample.com%2Fresources%2Fpainter',
      )}">Meer informatie</a>`,
    );
  });

  it('links HTML term preview to the configured URL', async () => {
    const configuredServer = await server(catalog, {
      ...config,
      VIEW_URL_TEMPLATE: '{+uri}',
    });
    const response = await configuredServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/painter',
    });
    expect(response.body).toContain(
      `href="${escapeHtml('https://example.com/resources/painter')}"`,
    );
  });

  it('shows no birth in HTML term preview of a person whose birth date is empty', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/person-empty-date',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.body).toContain('<h1>Naamloos</h1>');
    expect(response.body).not.toContain('Geboren');
  });

  it('translates HTML preview', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/resources/artwork',
      headers: {
        'accept-language': 'en',
      },
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toMatch('<h1>The Night Watch</h1>');
    expect(response.body).toMatch('One of the most famous Dutch paintings');
    expect(response.body).toMatch(
      '<dt>Alternative labels</dt><dd>Night Watch alt</dd>',
    );
    expect(response.body).toMatch(
      new RegExp(
        '<dt>Related terms</dt>\\s*<dd>All things art &#8226; Rembrandt</dd>',
      ),
    );
  });

  it('shows empty HTML term preview if term is not found', async () => {
    const response = await httpServer.inject({
      method: 'GET',
      url: '/preview/https://example.com/does-not-exist',
    });
    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-type']).toEqual('text/html');
    expect(response.body).toEqual('Niet gevonden');
  });
});

async function reconciliationQuery(
  reconciliationUrl: string,
  query: ReconciliationQueryBatch = {
    q1: {
      query: 'nachtwacht',
    },
    q2: {
      query: 'Things',
    },
    q3: {
      query: 'This yields no results',
    },
  },
) {
  const response = await httpServer.inject({
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: `/reconcile/${reconciliationUrl}`,
    payload: new URLSearchParams([
      ['queries', JSON.stringify(query)],
    ]).toString(),
  });
  expectSpecCompliant(response, 'reconciliation-result-batch');

  return response;
}

async function dataExtensionQuery({
  url = '/extend',
  query,
  language,
}: {
  url: string;
  query?: DataExtensionQuery;
  language?: string;
}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': language === undefined ? '*' : language,
  };
  const response = await httpServer.inject({
    method: 'POST',
    headers,
    url,
    payload: query ?? {
      ids: [
        'https://example.com/resources/artwork',
        'https://example.com/resources/painter',
      ],
      properties: allProperties,
    },
  });
  expectSpecCompliant(response, 'data-extension-response');

  return response;
}

/**
 * A successful response must be as the spec defines it; an error response has no schema.
 */
function expectSpecCompliant(
  response: LightMyRequestResponse,
  schema: SpecSchema,
) {
  if (response.statusCode === 200) {
    expect(specViolations(schema, JSON.parse(response.body))).toEqual([]);
  }
}

const allProperties = dataExtensionProperties.map((property) => ({
  id: property.id,
}));
