import {cli} from 'cli-ux';
import {Command, flags} from '@oclif/command';
import {DistributionsService} from '../../services/distributions';
import * as Logger from '../../helpers/logger';
import {Error, TermsResult} from '../../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../../services/terms';
import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';
import {QueryMode} from '../../search/query-mode';

interface Row {
  datasetTitle: string;
  termUri: string;
  prefLabels: string;
  altLabels: string;
}

export class QuerySourcesCommand extends Command {
  static description = 'Query sources for terms';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static flags: flags.Input<any> = {
    uris: flags.string({
      description:
        'URIs of sources to query, comma-separated, e.g. "https://www.wikidata.org/sparql,https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql"',
      required: true,
    }),
    query: flags.string({
      description: 'Query, e.g. "Gogh" or "fiets"',
      required: true,
    }),
    queryMode: flags.enum({
      description:
        'The mode in which the literal search query (`query`) is interpreted before it is sent to the term sources.',
      options: Object.keys(QueryMode),
      required: true,
      default: 'SMART',
    }),
    loglevel: flags.string({
      description: 'Log messages of a given level; defaults to "warn"',
      options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      required: false,
      default: 'warn',
    }),
    timeout: flags.integer({
      description: 'Query timeout in ms',
      required: false,
      default: 10000,
    }),
  };

  protected render(results: TermsResult[], catalog: Catalog): void {
    const rowsPerDistribution = results.map((result: TermsResult): Row[] => {
      if (result instanceof Error) {
        return [];
      }

      return result.terms.map(
        (term: Term): Row => {
          return {
            datasetTitle:
              catalog.getDatasetByDistributionIri(result.distribution.iri)
                ?.name ?? '',
            termUri: term.id!.value,
            prefLabels: term.prefLabels
              .map((prefLabel: RDF.Term) => prefLabel.value)
              .join(' / '),
            altLabels: term.altLabels
              .map((altLabel: RDF.Term) => altLabel.value)
              .join(' / '),
          };
        }
      );
    });
    const rows = ([] as Row[]).concat(...rowsPerDistribution); // Flatten array

    cli.table(rows, {
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
    const {flags} = this.parse(QuerySourcesCommand);
    const sources = flags.uris
      .split(',')
      .map((distributionId: string) => new IRI(distributionId.trim()));

    const logger = Logger.getCliLogger({
      name: 'cli',
      level: flags.loglevel,
    });
    const catalog = await Catalog.default();
    const comunica = newEngine();
    const service = new DistributionsService({logger, catalog, comunica});
    const results = await service.queryAll({
      sources,
      query: flags.query,
      queryMode: QueryMode[flags.queryMode as keyof typeof QueryMode],
      timeoutMs: flags.timeout,
    });
    this.render(results, catalog);
  }
}
