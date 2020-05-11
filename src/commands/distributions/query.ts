import { cli } from 'cli-ux';
import { Command, flags } from '@oclif/command';
import { DistributionsService } from '../../services/distributions';
import { Term } from '../../services/terms';
import * as RDF from 'rdf-js';

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

  protected render(results: Term[][]): void {
    for (const terms of results) {
      cli.table(terms, {
        prefLabels: {
          header: 'Pref labels',
          get: (term: Term) =>
            term.prefLabels
              .map((prefLabel: RDF.Term) => prefLabel.value)
              .join(' / '),
        },
        id: {
          header: 'ID',
          get: (term: Term) => term.id!.value,
        },
      });
    }
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
