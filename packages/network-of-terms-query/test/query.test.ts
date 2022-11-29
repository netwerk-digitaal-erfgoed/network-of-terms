import {testCatalog} from '../src/server-test';
import {IRI, QueryMode, QueryTermsService} from '../src';
import {QueryEngine} from '@comunica/query-sparql';
import {ArrayIterator} from 'asynciterator';
import {jest} from '@jest/globals';
import RDF from '@rdfjs/types';

const catalog = testCatalog(1000);
const comunicaMock = jest.mocked({
  queryQuads: jest.fn(
    (_query: string, _config: object) =>
      new ArrayIterator([], {autoStart: false})
  ),
});
const service = new QueryTermsService({
  comunica: comunicaMock as unknown as QueryEngine,
});

describe('Query', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });
  it('passes dataset IRI query parameter to Comunica', async () => {
    const config = await query(
      new IRI('https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql')
    );
    expect(config.initialBindings.get('datasetUri')?.value).toEqual(
      'https://data.rkd.nl/rkdartists'
    );
  });

  it('supports HTTP authentication', async () => {
    const config = await query(
      new IRI('https://data.beeldengeluid.nl/id/datadownload/0026')
    );

    // Must not contain credentials in URL...
    expect(config.sources[0].value).toEqual(
      'https://gtaa.apis.beeldengeluid.nl/sparql'
    );
    // ... but in separate httpAuth context element.
    expect(config.httpAuth).toEqual('username:password');
  });
});

const query = async (iri: IRI) => {
  const dataset = catalog.getDatasetByDistributionIri(iri)!;
  await service.search(
    'van gogh',
    QueryMode.OPTIMIZED,
    dataset,
    dataset.getDistributionByIri(iri)!,
    10000
  );

  return comunicaMock.queryQuads.mock.calls[0][1] as {
    httpAuth: string;
    sources: [
      {
        type: 'sparql';
        value: string;
      }
    ];
    initialBindings: Map<string, RDF.Term>;
  };
};
