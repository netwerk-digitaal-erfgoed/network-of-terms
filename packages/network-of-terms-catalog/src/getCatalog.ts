import fs from 'fs';
import {rdfParser} from 'rdf-parse';
import * as RDF from '@rdfjs/types';
import {QueryEngine} from '@comunica/query-sparql-rdfjs';
import {Transform, TransformCallback} from 'stream';
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
import {BindingsFactory} from '@comunica/utils-bindings-factory';
import {Bindings} from '@rdfjs/types';

export async function getCatalog(path?: string): Promise<Catalog> {
  const directory = (
    path ?? fileURLToPath(new URL('../catalog', import.meta.url))
  ).replace(/\\/g, '/'); // Windows compatibility.
  const store = await fromFiles(directory);
  return fromStore(store);
}

export async function fromStore(store: RDF.Store): Promise<Catalog> {
  // Collect all properties for SELECT and GROUP BY so we can flatten the schema:url values into a single value.
  const properties =
    '?dataset ?name ?description ?creator ?creatorName ?creatorAlternateName ?distribution ?endpointUrl ?searchQuery ?lookupQuery ?reconciliationUrlTemplate ?alternateName ?mainEntityOfPage ?inLanguage';
  const query = `
      PREFIX schema: <http://schema.org/>
        SELECT ${properties} (GROUP_CONCAT(?genre) as ?genre) (GROUP_CONCAT(DISTINCT ?url) as ?url) WHERE {
          ?dataset a schema:Dataset ;
            schema:name ?name ;
            schema:description ?description ;
            schema:genre ?genre ;
            schema:inLanguage ?inLanguage ;
            schema:creator ?creator ;
            schema:distribution ?distribution ;
            schema:url ?url ;
            schema:mainEntityOfPage ?mainEntityOfPage .
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
          OPTIONAL { ?dataset schema:alternateName ?alternateName . }
        }
        GROUP BY ${properties}
        ORDER BY LCASE(?name)`;
  const bindingsStream = await new QueryEngine().queryBindings(query, {
    sources: [store],
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
            .get('genre')!
            .value.split(' ') // The single value is space-delineated.
            .map((genre: string) => new IRI(genre)),
          bindings
            .get('url')!
            .value.split(' ') // The single value is space-delineated.
            .map((url: string) => new IRI(url)),
          bindings.get('mainEntityOfPage')!.value,
          bindings.get('inLanguage')!.value,
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
                              '{dataset}',
                              bindings.get('dataset')!.value.replace('#', '%23') // Escape # in URL.
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
export async function fromFiles(directory: string): Promise<RDF.Store> {
  // Read all files except those in the queries/ directory.
  const files = await globby([directory, '!' + directory + '/queries']);
  return (await Promise.all(files.map(fromFile))).reduce(
    (previous, current) => {
      previous.import(current.match());
      return previous;
    }
  );
}

export async function fromFile(file: string): Promise<RDF.Store> {
  const quadStream = rdfParser
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
      const file = fileURLToPath(
        new URL('../' + quad.object.value.substr(7), import.meta.url)
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
