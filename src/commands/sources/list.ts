import {CatalogService, Distribution} from '../../services/catalog';
import {cli} from 'cli-ux';
import {Command, flags} from '@oclif/command';
import * as Logger from '../../helpers/logger';

export class ListSourcesCommand extends Command {
  static description = 'List queryable sources';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      distributionTitle: {
        header: 'Source Name',
        get: (distribution: Distribution) =>
          distribution.distributionTitle.value,
      },
      distributionId: {
        header: 'Source ID',
        get: (distribution: Distribution) => distribution.distributionId.value,
      },
    });
  }

  async run(): Promise<void> {
    const {flags} = this.parse(ListSourcesCommand);
    const logger = Logger.getCliLogger({
      name: 'cli',
      level: flags.loglevel,
    });
    const service = new CatalogService({logger});
    const distributions = await service.listDistributions();
    this.render(distributions);
  }
}
