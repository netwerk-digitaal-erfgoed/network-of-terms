import {cli} from 'cli-ux';
import {Command} from '@oclif/command';
import {
  Catalog,
  Dataset,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

export class ListSourcesCommand extends Command {
  static description = 'List queryable sources';

  protected render(datasets: readonly Dataset[]): void {
    cli.table(datasets as Dataset[], {
      distributionTitle: {
        header: 'Source Name',
        get: (dataset: Dataset) => dataset.name,
      },
      distributionId: {
        header: 'Source ID',
        get: (dataset: Dataset) => dataset.identifier,
      },
    });
  }

  async run(): Promise<void> {
    const catalog = await Catalog.default();
    this.render(catalog.datasets);
  }
}
