import {
  Catalog,
  Dataset,
  Feature,
  FeatureType,
  Organization,
  SparqlDistribution,
} from './index.js';
import { setup, teardown as teardownServer } from 'jest-dev-server';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { SpawndChildProcess } from 'spawnd';
import nock from 'nock';

nock('https://example.com')
  .post('/distributions/timeout')
  .delay(3000)
  .reply(200)
  .persist();

export const teardown = async () => {
  await teardownServer(servers);
};

let servers: SpawndChildProcess[];
export const testCatalog = (port: number) =>
  new Catalog([
    new Dataset(
      'https://data.rkd.nl/rkdartists',
      { nl: 'RKDartists', en: 'RKDartists' },
      {
        nl: 'Biografische gegevens van Nederlandse en buitenlandse kunstenaars van de middeleeuwen tot heden',
      },
      ['https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Personen'],
      ['https://example.com/resources/'],
      'https://example.com/rkdartists',
      ['en', 'nl'],
      [
        new Organization(
          'https://rkd.nl',
          { nl: 'RKD – Nederlands Instituut voor Kunstgeschiedenis' },
          { nl: 'RKD' },
        ),
      ],
      [
        new SparqlDistribution(
          'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql',
          `http://localhost:${port}/sparql`,
          `
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          CONSTRUCT { 
            ?s ?p ?o 
          }
          WHERE {
            {
              SELECT DISTINCT ?s WHERE {
                ?s ?labelPredicate ?label .
                VALUES ?labelPredicate { skos:prefLabel skos:altLabel skos:hiddenLabel }
                FILTER (regex(?label, ?query, "i"))            
              }
              #LIMIT#
            }
              
            ?s ?p ?o .
           
            OPTIONAL { 
              ?s skos:exactMatch ?match .
              ?match skos:prefLabel ?match_label .
            }  
          }`,
          `
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          CONSTRUCT {
            ?s ?p ?o ;
              skos:broader ?broader_uri ;
              skos:narrower ?narrower_uri ;
              skos:related ?related_uri ;
              skos:inScheme <https://data.rkd.nl/rkdartists> .
            ?broader_uri skos:prefLabel ?broader_prefLabel .
            ?narrower_uri skos:prefLabel ?narrower_prefLabel .
            ?related_uri skos:prefLabel ?related_prefLabel .
          } 
          WHERE { 
            ?s ?p ?o.
            VALUES ?s { ?uris }
            OPTIONAL { 
              ?s skos:broader ?broader_uri.
              ?broader_uri skos:prefLabel ?broader_prefLabel. 
            } 
            OPTIONAL { 
              ?s skos:narrower ?narrower_uri.
              ?narrower_uri skos:prefLabel ?narrower_prefLabel. 
            } 
            OPTIONAL { 
              ?s skos:related ?related_uri.
              ?related_uri skos:prefLabel ?related_prefLabel. 
            } 
          }`,
          [
            new Feature(
              FeatureType.RECONCILIATION,
              new URL('https://example.com/reconcile/rkd'),
            ),
          ],
        ),
      ],
      { nl: 'RKD' },
    ),
    new Dataset(
      'https://data.cultureelerfgoed.nl/term/id/cht',
      { nl: 'Cultuurhistorische Thesaurus' },
      { nl: 'Onderwerpen voor het beschrijven van cultureel erfgoed' },
      [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Abstracte-begrippen',
      ],
      ['https://data.cultureelerfgoed.nl/term/id/cht/'],
      'https://example.com/cht',
      ['nl'],
      [
        new Organization(
          'https://www.cultureelerfgoed.nl',
          { nl: 'Rijksdienst voor het Cultureel Erfgoed' },
          { nl: 'RCE' },
        ),
      ],
      [
        new SparqlDistribution(
          'https://example.com/distributions/endpoint-error',
          'http://does-not-resolve',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          [
            new Feature(
              FeatureType.RECONCILIATION,
              new URL('https://example.com/reconcile/cht'),
            ),
          ],
        ),
      ],
    ),
    new Dataset(
      'http://vocab.getty.edu/aat',
      { nl: 'Art & Architecture Thesaurus' },
      {
        nl: 'Onderwerpen voor het beschrijven van architectuur-, kunst- en cultuurhistorische collecties',
      },
      [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Abstracte-begrippen',
      ],
      ['http://vocab.getty.edu/aat/'],
      'https://example.com/aat',
      ['nl'],
      [
        new Organization(
          'http://www.getty.edu/research/',
          { nl: 'Getty Research Institute' },
          { nl: 'Getty' },
        ),
      ],
      [
        new SparqlDistribution(
          'https://example.com/distributions/timeout',
          'https://example.com/distributions/timeout',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
        ),
      ],
    ),
    new Dataset(
      'http://data.beeldengeluid.nl/gtaa/Persoonsnamen',
      { nl: 'GTAA: persoonsnamen' },
      { nl: 'Personen voor het beschrijven van audiovisueel materiaal' },
      [
        'https://data.cultureelerfgoed.nl/termennetwerk/onderwerpen/Abstracte-begrippen',
      ],
      ['http://data.beeldengeluid.nl/gtaa/'],
      'https://example.com/gtaa',
      ['nl'],
      [
        new Organization(
          'https://www.beeldengeluid.nl/',
          { nl: 'Nederlands Instituut voor Beeld en Geluid' },
          { nl: 'Beeld en Geluid' },
        ),
      ],
      [
        new SparqlDistribution(
          'https://data.beeldengeluid.nl/id/datadownload/0026',
          'https://username:password@gtaa.apis.beeldengeluid.nl/sparql',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
        ),
      ],
    ),
  ]);

export async function startDistributionSparqlEndpoint(
  port: number,
): Promise<void> {
  servers = await setup({
    command: `npx comunica-sparql-file-http ${dirname(
      fileURLToPath(import.meta.url),
    )}/../test/fixtures/terms.ttl -p ${port}`,
    port,
    launchTimeout: 20000,
  });
}
