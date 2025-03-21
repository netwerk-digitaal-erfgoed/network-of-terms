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
import {ldkit, rdf, schema} from 'ldkit/namespaces';
import {createLens} from 'ldkit';

export async function getCatalog(path?: string): Promise<Catalog> {
  const directory = (
    path ?? fileURLToPath(new URL('../catalog', import.meta.url))
  ).replace(/\\/g, '/'); // Windows compatibility.
  const store = await fromFiles(directory);
  return fromStore(store);
}

const catalogSchema = {
  '@type': schema.Dataset,
  name: {
    '@id': schema.name,
    '@multilang': true,
  },
  alternateName: {
    '@id': schema.alternateName,
    '@multilang': true,
    '@optional': true,
  },
  description: {
    '@id': schema.description,
    '@multilang': true,
  },
  inLanguage: {
    '@id': schema.inLanguage,
    '@array': true,
  },
  genres: {
    '@id': schema.genre,
    '@array': true,
  },
  creator: {
    '@id': schema.creator,
    '@schema': {
      '@type': schema.Organization,
      name: {
        '@id': schema.name,
        '@multilang': true,
      },
      alternateName: {
        '@id': schema.alternateName,
        '@multilang': true,
      },
    },
  },
  distribution: {
    '@id': schema.distribution,
    '@schema': {
      encodingFormat: schema.encodingFormat,
      contentUrl: schema.contentUrl,
      potentialAction: {
        '@array': true,
        '@id': schema.potentialAction,
        '@schema': {
          // '@type': schema.Action,
          types: {
            '@id': rdf.type,
            '@type': ldkit.IRI,
            '@array': true,
          },
          query: {
            '@id': schema.query,
            '@optional': true,
          },
          target: {
            '@id': schema.target,
            '@optional': true,
            '@schema': {
              actionApplication: {
                '@id': schema.actionApplication,
                '@schema': {
                  '@type': schema.SoftwareApplication,
                },
              },
              urlTemplate: {
                '@id': schema.urlTemplate,
              },
            },
          },
        },
      },
    },
  },
  mainEntityOfPage: schema.mainEntityOfPage,
  url: schema.url,
} as const;

const engine = new QueryEngine();

export async function fromStore(store: RDF.Store): Promise<Catalog> {
  const lens = createLens(catalogSchema, {
    sources: [store],
    engine,
  });

  const datasets = await lens.find(); // where Only makes it slower.

  return new Catalog(
    datasets.map(
      dataset =>
        new Dataset(
          new IRI(dataset.$id),
          dataset.name,
          dataset.description,
          dataset.genres.map(genre => new IRI(genre)),
          [new IRI(dataset.url)],
          dataset.mainEntityOfPage,
          dataset.inLanguage,
          [
            new Organization(
              new IRI(dataset.creator.$id),
              dataset.creator.name,
              dataset.creator.alternateName
            ),
          ],
          [
            new SparqlDistribution(
              new IRI(dataset.distribution.$id),
              new IRI(dataset.distribution.contentUrl),
              dataset.distribution.potentialAction.filter(action =>
                action.types.includes(schema.SearchAction)
              )[0].query!,
              dataset.distribution.potentialAction.filter(action =>
                action.types.includes(schema.FindAction)
              )[0].query!,
              dataset.distribution.potentialAction
                .filter(
                  action =>
                    action.target?.actionApplication.$id ===
                    'https://reconciliation-api.github.io/specs/latest/'
                )
                .map(
                  reconciliation =>
                    new Feature(
                      FeatureType.RECONCILIATION,
                      new URL(
                        reconciliation.target!.urlTemplate!.replace(
                          '{dataset}',
                          dataset.$id.replace('#', '%23') // Escape # in URL.
                        )
                      )
                    )
                )
            ),
          ],
          dataset.alternateName
        )
    )
  );
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
