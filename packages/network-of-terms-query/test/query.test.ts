import {testCatalog} from '../src/server-test';
import {IRI, QueryMode, QueryTermsService} from '../src';
import {ActorInitSparql} from '@comunica/actor-init-sparql';
import {ArrayIterator} from 'asynciterator';
import factory from '@rdfjs/data-model';
import {jest} from '@jest/globals';
import RDF from 'rdf-js';

describe('Query', () => {
  it('passes dataset IRI query parameter to Comunica', async () => {
    const catalog = testCatalog(1000);
    const comunicaMock = jest.mocked({
      query: jest.fn((_query: string, _config: object) => ({
        type: 'quads',
        quadStream: new ArrayIterator([], {autoStart: false}),
      })),
    });
    const service = new QueryTermsService({
      comunica: comunicaMock as unknown as ActorInitSparql,
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

    const config = comunicaMock.query.mock.calls[0][1] as {
      initialBindings: Map<string, RDF.Term>;
    };
    expect(config.initialBindings.get('?datasetUri')).toEqual(
      factory.namedNode(dataset.iri.toString())
    );
  });
});
