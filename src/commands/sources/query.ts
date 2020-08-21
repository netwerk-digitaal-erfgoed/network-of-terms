import {cli} from 'cli-ux';
import {Command, flags} from '@oclif/command';
import {DistributionsService} from '../../services/distributions';
import * as Logger from '../../helpers/logger';
import {QueryResult} from '../../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../../services/terms';
import {Catalog} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';

interface Row {
  distributionTitle: string;
  termUri: string;
  prefLabels: string;
  altLabels: string;
}

export class QuerySourcesCommand extends Command {
  static description = 'Query sources for terms';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static flags: flags.Input<any> = {
    identifiers: flags.string({
      description:
        'Identifiers of sources to query, comma-separated, e.g. "nta,rkdartists"',
      required: true,
    }),
    query: flags.string({
      description: 'Query, e.g. "Gogh" or "fiets"',
      required: true,
    }),
    loglevel: flags.string({
      description: 'Log messages of a given level; defaults to "warn"',
      options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      required: false,
      default: 'warn',
    }),
  };

  protected render(results: QueryResult[]): void {
    const rowsPerDistribution = results.map((result: QueryResult): Row[] => {
      return result.terms.map(
        (term: Term): Row => {
          return {
            distributionTitle: result.dataset.distribution.url.toString(),
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
      distributionTitle: {
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
    const sources = flags.identifiers
      .split(',')
      .map((distributionId: string) => distributionId.trim());

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
    });
    this.render(results);
  }
}
