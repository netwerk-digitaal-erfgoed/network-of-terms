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
            schema:distribution ?distribution ;
            schema:name ?name ;
            schema:identifier ?identifier .
          ?distribution schema:contentUrl ?distributionUrl ;
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
            new URL(bindings.get('?dataset').value),
            bindings.get('?name').value,
            bindings.get('?identifier').value,
            new Distribution(
              new URL(bindings.get('?distributionUrl').value),
              bindings.get('?query').value
            )
          )
        );
      });
      result.bindingsStream.on('end', () => resolve(datasets));
      result.bindingsStream.on('error', () => reject);
    });

    return new Catalog(await promise);
  }
}

export class Dataset {
  constructor(
    readonly iri: IRI,
    readonly name: string,
    readonly identifier: string,
    readonly distribution: Distribution
  ) {}
}

export class Distribution {
  constructor(readonly url: URL, readonly query: string) {}
}

export type IRI = URL;

function addStreamToStore(
  store: RDF.Store,
  stream: RDF.Stream
): Promise<RDF.Store> {
  return new Promise(resolve =>
    store.import(stream).once('end', () => resolve(store))
  );
}

export async function fromFiles(directory: string): Promise<RDF.Store> {
  const files = fs.readdirSync(directory);
  const store = new N3.Store();
  for (const file of files) {
    const quadStream = RdfParser.parse(
      fs.createReadStream(directory + '/' + file),
      {path: file}
    ).pipe(new InlineFiles());
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
      const file = Path.resolve(quad.object.value.substr(7));
      quad.object.value = await fs.promises.readFile(file, 'utf-8');
    }

    this.push(quad, encoding);

    callback();
  }
}
