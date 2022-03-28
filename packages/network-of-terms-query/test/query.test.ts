import {testCatalog} from '../src/server-test';
import {IRI, QueryMode, QueryTermsService} from '../src';
import {QueryEngine} from '@comunica/query-sparql';
import {ArrayIterator} from 'asynciterator';
import {jest} from '@jest/globals';
import RDF from 'rdf-js';

describe('Query', () => {
  it('passes dataset IRI query parameter to Comunica', async () => {
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
    const dataset = catalog.getDatasetByDistributionIri(
      new IRI('https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql')
    )!;

    await service.search(
      'van gogh',
      QueryMode.OPTIMIZED,
      dataset,
      dataset.getDistributionByIri(
        new IRI('https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql')
      )!,
      10000
    );

    const config = comunicaMock.queryQuads.mock.calls[0][1] as {
      initialBindings: Map<string, RDF.Term>;
    };
    expect(config.initialBindings.get('datasetUri')?.value).toEqual(
      dataset.iri.toString()
    );
  });
});