import fs from 'fs';
import rdfParser from 'rdf-parse';
import * as RDF from '@rdfjs/types';
import {QueryEngine} from '@comunica/query-sparql-rdfjs';
import {Transform, TransformCallback} from 'stream';
import {dirname, resolve} from 'path';
import {globby} from 'globby';
import {storeStream} from 'rdf-store-stream';
import {
  Catalog,
  Dataset,
  Feature,
  FeatureType,
  IRI,
  Organization,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {fileURLToPath} from 'url';
import {DataFactory} from 'rdf-data-factory';
import {BindingsFactory} from '@comunica/bindings-factory';
import {Bindings} from '@rdfjs/types';

export async function defaultCatalog(): Promise<Catalog> {
  const directory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../',
    'catalog/'
  );
  const store = await fromFiles(directory);
  return fromStore(store);
}

export async function fromStore(store: RDF.Store[]): Promise<Catalog> {
  // Collect all properties for SELECT and GROUP BY so we can flatten the schema:url values into a single value.
  const properties =
    '?dataset ?name ?description ?creator ?creatorName ?creatorAlternateName ?distribution ?endpointUrl ?searchQuery ?lookupQuery ?reconciliationUrlTemplate ?alternateName';
  const query = `
      PREFIX schema: <http://schema.org/>
        SELECT ${properties} (GROUP_CONCAT(?url) as ?url)  WHERE {
          ?dataset a schema:Dataset ;
            schema:name ?name ;
            schema:description ?description ;
            schema:creator ?creator ;
            schema:distribution ?distribution ;
            schema:url ?url .
          OPTIONAL { ?dataset schema:alternateName ?alternateName . }
          ?creator schema:name ?creatorName ;
            schema:alternateName ?creatorAlternateName .
          ?distribution schema:encodingFormat "application/sparql-query" ;
            schema:contentUrl ?endpointUrl ;
            schema:potentialAction
                [a schema:SearchAction ; schema:query ?searchQuery ] ,
                [a schema:FindAction ; schema:query ?lookupQuery ] .
            OPTIONAL { 
                ?distribution schema:potentialAction/schema:target ?entryPoint .
                ?entryPoint schema:actionApplication ?reconciliationIri ;
                    schema:urlTemplate ?reconciliationUrlTemplate .
            } 
        }
        GROUP BY ${properties}
        ORDER BY LCASE(?name)`;
  const bindingsStream = await new QueryEngine().queryBindings(query, {
    sources: store as [RDF.Store, ...RDF.Store[]],
    initialBindings: bindingsFactory.fromRecord({
      reconciliationIri: dataFactory.namedNode(FeatureType.RECONCILIATION),
    }) as unknown as Bindings,
  });

  const promise: Promise<Dataset[]> = new Promise((resolve, reject) => {
    const datasets: Dataset[] = [];
    bindingsStream.on('data', (bindings: RDF.Bindings) => {
      datasets.push(
        new Dataset(
          new IRI(bindings.get('dataset')!.value),
          bindings.get('name')!.value,
          bindings.get('description')!.value,
          bindings
            .get('url')!
            .value.split(' ') // The single value is space-delineated.
            .map((url: string) => new IRI(url)),
          [
            new Organization(
              new IRI(bindings.get('creator')!.value),
              bindings.get('creatorName')!.value,
              bindings.get('creatorAlternateName')!.value
            ),
          ],
          [
            new SparqlDistribution(
              new IRI(bindings.get('distribution')!.value),
              new IRI(bindings.get('endpointUrl')!.value),
              bindings.get('searchQuery')!.value,
              bindings.get('lookupQuery')!.value,
              [
                ...(bindings.has('reconciliationUrlTemplate')
                  ? [
                      new Feature(
                        FeatureType.RECONCILIATION,
                        new URL(
                          bindings
                            .get('reconciliationUrlTemplate')!
                            .value.replace(
                              '{distribution}',
                              bindings
                                .get('distribution')!
                                .value.replace('#', '%23') // Escape # in URL.
                            )
                        )
                      ),
                    ]
                  : []),
              ]
            ),
          ],
          bindings.get('alternateName')?.value
        )
      );
    });
    bindingsStream.on('end', () => resolve(datasets));
    bindingsStream.on('error', () => reject);
  });

  return new Catalog(await promise);
}

/**
 * Return a separate RDF.Store for each catalog file because merging them into a single store
 * causes blank nodes to be re-used instead of incremented when adding the next file.
 */
export async function fromFiles(directory: string): Promise<RDF.Store[]> {
  // Read all files except those in the queries/ directory.
  const files = await globby([directory, '!' + directory + '/queries']);
  return Promise.all(files.map(fromFile));
}

export async function fromFile(file: string): Promise<RDF.Store> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const quadStream = (rdfParser.default ?? RdfParser)
    .parse(fs.createReadStream(file), {
      path: file,
    })
    .pipe(new InlineFiles())
    .pipe(new SubstituteCredentialsFromEnvironmentVariables());
  return storeStream(quadStream);
}

/**
 * An RDF.Quad transform that inlines file://... references in the quad's object value.
 */
class InlineFiles extends Transform {
  constructor() {
    super({objectMode: true});
  }

  async _transform(
    quad: RDF.Quad,
    encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    if (quad.object.value.startsWith('file://')) {
      const file = resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../',
        quad.object.value.substr(7)
      );
      quad.object.value = await fs.promises.readFile(file, 'utf-8');
    }

    this.push(quad, encoding);

    callback();
  }
}

/**
 * An RDF.Quad transform that replaces $ENV_VAR variables in schema:contentUrl objects with the value of the environment
 * value with the same name.
 */
class SubstituteCredentialsFromEnvironmentVariables extends Transform {
  private regex = new RegExp('\\$(.+)(?=@)');
  constructor() {
    super({objectMode: true});
  }

  async _transform(
    quad: RDF.Quad,
    encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    if (quad.predicate.value === 'http://schema.org/contentUrl') {
      quad.object.value = quad.object.value.replace(
        this.regex,
        (match, envVar) => process.env[envVar] ?? ''
      );
    }

    this.push(quad, encoding);

    callback();
  }
}

const dataFactory = new DataFactory();
const bindingsFactory = new BindingsFactory(dataFactory);
