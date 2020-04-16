import { CatalogService, Distribution } from '../../services/catalog';
import { cli } from 'cli-ux';
import { Command, flags } from '@oclif/command';

export class ListDistributionsCommand extends Command {
  static description =
    'List the queryable dataset distributions in the catalog';
  // tslint:disable-next-line:no-any
  static flags: flags.Input<any> = {
    loglevel: flags.string({
      description: 'Log messages of a given level; defaults to "warn"',
      options: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      required: false,
      default: 'warn',
    }),
  };

  protected render(distributions: Distribution[]): void {
    cli.table(distributions, {
      datasetTitle: {
        header: 'Dataset',
      },
      distributionTitle: {
        header: 'Distribution',
      },
      distributionId: {
        header: 'Identifier',
      },
    });
  }

  async run(): Promise<void> {
    const { flags } = this.parse(ListDistributionsCommand);
    const service = new CatalogService({
      logLevel: flags.loglevel,
    });
    const distributions = await service.listDistributions();
    this.render(distributions);
  }
}
