import { Command, flags } from '@oclif/command';
import { DistributionsService } from '../../services/distributions';

export class QueryDistributionsCommand extends Command {
  static description = 'Query dataset distributions';
  // tslint:disable-next-line:no-any
  static flags: flags.Input<any> = {
    identifiers: flags.string({
      description:
        'Identifiers of dataset distributions to query, comma-separated, e.g. "rkdartists-sparql,rkdartists-fragments"',
      required: true,
    }),
    'search-term': flags.string({
      description: 'Search term, e.g. "Gogh" or "fiets"',
      required: true,
    }),
    loglevel: flags.string({
      description: 'Log messages of a given level; defaults to "warn"',
      options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      required: false,
      default: 'warn',
    }),
  };

  protected render(results: NodeJS.ReadableStream[]): void {
    for (const result of results) {
      result.pipe(process.stdout);
    }
  }

  async run(): Promise<void> {
    const { flags } = this.parse(QueryDistributionsCommand);
    const distributionsIds = flags.identifiers
      .split(',')
      .map((distributionId: string) => distributionId.trim());

    const service = new DistributionsService({
      logLevel: flags.loglevel,
    });
    const results = await service.queryAll({
      distributionsIds,
      searchTerm: flags['search-term'],
    });
    this.render(results);
  }
}
