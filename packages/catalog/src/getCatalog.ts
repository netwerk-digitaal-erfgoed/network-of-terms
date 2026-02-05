import fs from 'fs';
import { rdfParser } from 'rdf-parse';
import { QueryEngine } from '@comunica/query-sparql-rdfjs';
import { Transform, TransformCallback } from 'stream';
import { globby } from 'globby';
import {
  Catalog,
  Dataset,
  Feature,
  FeatureType,
  Organization,
  SparqlDistribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import { fileURLToPath } from 'url';
import { ldkit, rdf, schema } from 'ldkit/namespaces';
import { createLens, type IQueryEngine } from 'ldkit';
import type RDF from '@rdfjs/types';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { RdfStore } from 'rdf-stores';

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
    '@optional': true, // Not strictly optional, but required properties cause slower SPARQL JOINs.
  },
  inLanguage: {
    '@id': schema.inLanguage,
    '@array': true,
    '@optional': true,
  },
  genres: {
    '@id': schema.genre,
    '@array': true,
    '@optional': true,
  },
  creator: {
    '@id': schema.creator,
    '@optional': true,
    '@schema': {
      '@type': schema.Organization,
      name: {
        '@id': schema.name,
        '@multilang': true,
        '@optional': true,
      },
      alternateName: {
        '@id': schema.alternateName,
        '@multilang': true,
        '@optional': true,
      },
    },
  },
  distribution: {
    '@id': schema.distribution,
    '@optional': true,
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
    // Cast needed: rdf-parse uses Comunica v4 types, incompatible with v5.
    engine: engine as unknown as IQueryEngine,
    distinctConstruct: true,
  });

  const datasets = await lens.find();

  return new Catalog(
    datasets.map(
      (dataset) =>
        new Dataset(
          dataset.$id,
          dataset.name,
          dataset.description,
          dataset.genres,
          [dataset.url],
          dataset.mainEntityOfPage,
          dataset.inLanguage,
          [
            new Organization(
              dataset.creator!.$id,
              dataset.creator!.name,
              dataset.creator!.alternateName,
            ),
          ],
          [
            new SparqlDistribution(
              dataset.distribution!.$id,
              dataset.distribution!.contentUrl,
              dataset.distribution!.potentialAction.filter((action) =>
                action.types.includes(schema.SearchAction),
              )[0].query!,
              dataset.distribution!.potentialAction.filter((action) =>
                action.types.includes(schema.FindAction),
              )[0].query!,
              dataset
                .distribution!.potentialAction.filter(
                  (action) =>
                    action.target?.actionApplication.$id ===
                    'https://reconciliation-api.github.io/specs/latest/',
                )
                .map(
                  (reconciliation) =>
                    new Feature(
                      FeatureType.RECONCILIATION,
                      new URL(
                        reconciliation.target!.urlTemplate!.replace(
                          '{dataset}',
                          dataset.$id.replace('#', '%23'), // Escape # in URL.
                        ),
                      ),
                    ),
                ),
            ),
          ],
          dataset.alternateName,
        ),
    ),
  );
}

/**
 * Return a separate RDF.Store for each catalog file because merging them into a single store
 * causes blank nodes to be re-used instead of incremented when adding the next file.
 */
async function fromFiles(directory: string): Promise<RDF.Store> {
  // Read all files except those in the queries/ directory.
  const files = await globby([directory + '/**', '!**/queries/**']);
  const store = RdfStore.createDefault();
  for (const file of files) {
    const stream = fromFile(file);
    await new Promise((resolve, reject) => {
      store.import(stream);
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }
  return store;
}

function fromFile(file: string): RDF.Stream & Readable {
  return rdfParser
    .parse(fs.createReadStream(file), {
      path: file,
    })
    .pipe(new InlineFiles(file))
    .pipe(new SubstituteCredentialsFromEnvironmentVariables());
}

/**
 * An RDF.Quad transform that inlines file://... references in the quad's object value.
 */
class InlineFiles extends Transform {
  private readonly path: string;

  constructor(fromFile: string) {
    super({ objectMode: true });
    this.path = dirname(fromFile);
  }

  override async _transform(
    quad: RDF.Quad,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    if (quad.object.value.startsWith('file://')) {
      const file = join(this.path, quad.object.value.substr(7));
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
    super({ objectMode: true });
  }

  override async _transform(
    quad: RDF.Quad,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    if (quad.predicate.value === 'http://schema.org/contentUrl') {
      quad.object.value = quad.object.value.replace(
        this.regex,
        (match, envVar) => process.env[envVar] ?? '',
      );
    }

    this.push(quad, encoding);

    callback();
  }
}
