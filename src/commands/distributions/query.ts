import { cli } from 'cli-ux';
import { Command, flags } from '@oclif/command';
import { DistributionsService } from '../../services/distributions';
import { QueryResult } from '../../services/query';
import * as RDF from 'rdf-js';
import { Term } from '../../services/terms';

interface Row {
  distributionId: string;
  termId: string;
  prefLabels: string;
  altLabels: string;
}

export class QueryDistributionsCommand extends Command {
  static description = 'Query dataset distributions';
  // tslint:disable-next-line:no-any
  static flags: flags.Input<any> = {
    identifiers: flags.string({
      description:
        'Identifiers of dataset distributions to query, comma-separated, e.g. "nta-sparql,rkdartists-sparql"',
      required: true,
    }),
    'search-terms': flags.string({
      description: 'Search terms, e.g. "Gogh" or "fiets"',
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
      const distributionId = result.accessService.distributionId;
      return result.terms.map(
        (term: Term): Row => {
          return {
            distributionId,
            termId: term.id!.value,
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
      distributionId: {
        header: 'Distribution ID',
      },
      termId: {
        header: 'Term ID',
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
    const { flags } = this.parse(QueryDistributionsCommand);
    const distributionIds = flags.identifiers
      .split(',')
      .map((distributionId: string) => distributionId.trim());

    const service = new DistributionsService({
      logLevel: flags.loglevel,
    });
    const results = await service.queryAll({
      distributionIds,
      searchTerms: flags['search-terms'],
    });
    this.render(results);
  }
}
