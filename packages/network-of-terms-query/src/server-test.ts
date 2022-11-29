import {
  Catalog,
  Dataset,
  Feature,
  FeatureType,
  IRI,
  Organization,
  SparqlDistribution,
} from './index';
import {setup} from 'jest-dev-server';
import {dirname} from 'path';
import {fileURLToPath} from 'url';

export const testCatalog = (port: number) =>
  new Catalog([
    new Dataset(
      new IRI('https://data.rkd.nl/rkdartists'),
      'RKDartists',
      'Biografische gegevens van Nederlandse en buitenlandse kunstenaars van de middeleeuwen tot heden',
      [new IRI('https://example.com/resources/')],
      [
        new Organization(
          new IRI('https://rkd.nl'),
          'RKD – Nederlands Instituut voor Kunstgeschiedenis',
          'RKD'
        ),
      ],
      [
        new SparqlDistribution(
          new IRI(
            'https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql'
          ),
          new IRI(`http://localhost:${port}/sparql`),
          `
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          CONSTRUCT { 
            ?s ?p ?o 
          }
          WHERE { 
            ?s ?p ?o ;
              ?labelPredicate ?label .
            VALUES ?labelPredicate { skos:prefLabel skos:altLabel skos:hiddenLabel }
            FILTER (regex(?label, ?query, "i"))
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
              new URL('https://example.com/reconcile/rkd')
            ),
          ]
        ),
      ]
    ),
    new Dataset(
      new IRI('https://data.cultureelerfgoed.nl/term/id/cht'),
      'Cultuurhistorische Thesaurus',
      'Onderwerpen voor het beschrijven van cultureel erfgoed',
      [new IRI('https://data.cultureelerfgoed.nl/term/id/cht/')],
      [
        new Organization(
          new IRI('https://www.cultureelerfgoed.nl'),
          'Rijksdienst voor het Cultureel Erfgoed',
          'RCE'
        ),
      ],
      [
        new SparqlDistribution(
          new IRI('https://example.com/distributions/endpoint-error'),
          new IRI('http://does-not-resolve'),
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          [
            new Feature(
              FeatureType.RECONCILIATION,
              new URL('https://example.com/reconcile/cht')
            ),
          ]
        ),
      ]
    ),
    new Dataset(
      new IRI('http://vocab.getty.edu/aat'),
      'Art & Architecture Thesaurus',
      'Onderwerpen voor het beschrijven van architectuur-, kunst- en cultuurhistorische collecties',
      [new IRI('http://vocab.getty.edu/aat/')],
      [
        new Organization(
          new IRI('http://www.getty.edu/research/'),
          'Getty Research Institute',
          'Getty'
        ),
      ],
      [
        new SparqlDistribution(
          new IRI('https://example.com/distributions/timeout'),
          new IRI('https://httpbin.org/delay/3'),
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'
        ),
      ]
    ),
    new Dataset(
      new IRI('http://data.beeldengeluid.nl/gtaa/Persoonsnamen'),
      'GTAA: persoonsnamen',
      'Personen voor het beschrijven van audiovisueel materiaal',
      [new IRI('http://data.beeldengeluid.nl/gtaa/')],
      [
        new Organization(
          new IRI('https://www.beeldengeluid.nl/'),
          'Nederlands Instituut voor Beeld en Geluid',
          'Beeld en Geluid'
        ),
      ],
      [
        new SparqlDistribution(
          new IRI('https://data.beeldengeluid.nl/id/datadownload/0026'),
          new IRI(
            'https://username:password@gtaa.apis.beeldengeluid.nl/sparql'
          ),
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }',
          'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'
        ),
      ]
    ),
  ]);

export async function startDistributionSparqlEndpoint(
  port: number
): Promise<void> {
  await setup({
    command: `npx comunica-sparql-file-http ${dirname(
      fileURLToPath(import.meta.url)
    )}/../test/fixtures/terms.ttl -p ${port}`,
    port,
    launchTimeout: 10000,
  });
}
