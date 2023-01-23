import {cli} from 'cli-ux';
import {Command, Flags} from '@oclif/core';
import {
  Catalog,
  DistributionsService,
  Error,
  getCliLogger,
  IRI,
  QueryMode,
  Term,
  TermsResponse,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import {getCatalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

interface Row extends Record<string, unknown> {
  datasetTitle: string;
  termUri: string;
  prefLabels: string;
  altLabels: string;
}

export class QuerySourcesCommand extends Command {
  static description = 'Query sources for terms';

  static flags = {
    uris: Flags.string({
      description:
        'URIs of sources to query, comma-separated, e.g. "https://www.wikidata.org/sparql,https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql"',
      required: true,
    }),
    query: Flags.string({
      description: 'Query, e.g. "Gogh" or "fiets"',
      required: true,
    }),
    queryMode: Flags.enum({
      description:
        'The mode in which the literal search query (`query`) is interpreted before it is sent to the term sources.',
      options: Object.keys(QueryMode),
      required: true,
      default: 'OPTIMIZED',
    }),
    loglevel: Flags.string({
      description: 'Log messages of a given level; defaults to "warn"',
      options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      required: false,
      default: 'warn',
    }),
    timeout: Flags.integer({
      description: 'Query timeout in ms',
      required: false,
      default: 10000,
    }),
  };

  private render(results: TermsResponse[], catalog: Catalog): void {
    const rowsPerDistribution = results.map(
      (response: TermsResponse): Row[] => {
        if (response.result instanceof Error) {
          return [];
        }

        return response.result.terms.map((term: Term): Row => {
          return {
            datasetTitle:
              catalog.getDatasetByDistributionIri(
                response.result.distribution.iri
              )?.name ?? '',
            termUri: term.id!.value,
            prefLabels: term.prefLabels
              .map(prefLabel => prefLabel.value)
              .join(' / '),
            altLabels: term.altLabels
              .map(altLabel => altLabel.value)
              .join(' / '),
          };
        });
      }
    );
    const rows = ([] as Row[]).concat(...rowsPerDistribution); // Flatten array

    cli.table<Row>(rows, {
      datasetTitle: {
        header: 'Source Name',
      },
      termUri: {
        header: 'Term URI',
      },
      prefLabels: {
        header: 'Preferred Labels',
      },
      altLabels: {
        header: 'Alternative Labels',
      },
    });
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(QuerySourcesCommand);
    const sources = flags.uris
      .split(',')
      .map((distributionId: string) => new IRI(distributionId.trim()));

    const logger = getCliLogger({
      name: 'cli',
      level: flags.loglevel,
    });
    const catalog = await getCatalog();
    const service = new DistributionsService({logger, catalog});
    const results = await service.queryAll({
      sources,
      query: flags.query,
      queryMode: QueryMode[flags.queryMode as keyof typeof QueryMode],
      timeoutMs: flags.timeout,
    });
    this.render(results, catalog);
  }
}
