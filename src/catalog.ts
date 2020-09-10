import fs from 'fs';
import RdfParser from 'rdf-parse';
import * as RDF from 'rdf-js';
import {newEngine} from '@comunica/actor-init-sparql-rdfjs';
import {
  Bindings,
  IActorQueryOperationOutputBindings,
} from '@comunica/bus-query-operation';
import {Transform, TransformCallback} from 'stream';
import Path from 'path';
import N3 = require('n3');
import {URL} from 'url';
import globby from 'globby';

export class Catalog {
  constructor(readonly datasets: ReadonlyArray<Dataset>) {}

  public static async default(): Promise<Catalog> {
    const directory = Path.resolve(__dirname, '../', 'catalog/');
    const store = await fromFiles(directory);
    return this.fromStore(store);
  }

  public static async fromStore(store: RDF.Store): Promise<Catalog> {
    const query = `
      PREFIX schema: <http://schema.org/>
        SELECT * WHERE {
          ?dataset a schema:Dataset ;
            schema:name ?name ;
            schema:creator ?creator ;
            schema:distribution ?distribution .
          ?creator schema:identifier ?creatorIdentifier .
          ?distribution schema:encodingFormat "application/sparql-query" ;
            schema:contentUrl ?endpointUrl ;
            schema:potentialAction/schema:query ?query .
        }
        ORDER BY LCASE(?name)`;
    const result = (await newEngine().query(query, {
      sources: [
        {
          type: 'rdfjsSource',
          value: store,
        },
      ],
    })) as IActorQueryOperationOutputBindings;

    const promise: Promise<Dataset[]> = new Promise((resolve, reject) => {
      const datasets: Dataset[] = [];
      result.bindingsStream.on('data', (bindings: Bindings) => {
        datasets.push(
          new Dataset(
            new IRI(bindings.get('?dataset').value),
            bindings.get('?name').value,
            [
              new Organization(
                new IRI(bindings.get('?creator').value),
                bindings.get('?creatorIdentifier').value
              ),
            ],
            [
              new SparqlDistribution(
                new IRI(bindings.get('?distribution').value),
                new IRI(bindings.get('?endpointUrl').value),
                bindings.get('?query').value
              ),
            ]
          )
        );
      });
      result.bindingsStream.on('end', () => resolve(datasets));
      result.bindingsStream.on('error', () => reject);
    });

    return new Catalog(await promise);
  }

  public getDatasetByDistributionIri(iri: IRI): Dataset | undefined {
    return this.datasets.find(
      dataset => dataset.getDistributionByIri(iri) !== undefined
    );
  }
}

export class Dataset {
  constructor(
    readonly iri: IRI,
    readonly name: string,
    readonly creators: [Organization],
    readonly distributions: [Distribution]
  ) {}

  public getDistributionByIri(iri: IRI): Distribution | undefined {
    return this.distributions.find(
      distribution => distribution.iri.toString() === iri.toString()
    );
  }
}

export class Organization {
  constructor(readonly iri: IRI, readonly identifier: string) {}
}

export class SparqlDistribution {
  constructor(
    readonly iri: IRI,
    readonly endpoint: IRI,
    readonly query: string
  ) {}
}

/**
 * A union type to be extended in the future with other distribution types.
 */
export type Distribution = SparqlDistribution;

export class IRI extends URL {}

function addStreamToStore(
  store: RDF.Store,
  stream: RDF.Stream
): Promise<RDF.Store> {
  return new Promise(resolve =>
    store.import(stream).once('end', () => resolve(store))
  );
}

export async function fromFiles(directory: string): Promise<RDF.Store> {
  // Read all files except those in the queries/ directory.
  const files = await globby([directory, '!' + directory + '/queries']);
  const store = new N3.Store();
  for (const file of files) {
    const quadStream = RdfParser.parse(fs.createReadStream(file), {
      path: file,
    }).pipe(new InlineFiles());
    await addStreamToStore(store, quadStream);
  }

  return store;
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
      const file = Path.resolve(__dirname, '../', quad.object.value.substr(7));
      quad.object.value = await fs.promises.readFile(file, 'utf-8');
    }

    this.push(quad, encoding);

    callback();
  }
}
