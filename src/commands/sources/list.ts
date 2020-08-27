import {cli} from 'cli-ux';
import {Command} from '@oclif/command';
import {
  Catalog,
  Dataset,
  Distribution,
} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';

type DatasetDistribution = {
  dataset: Dataset;
  distribution: Distribution;
};

export class ListSourcesCommand extends Command {
  static description = 'List queryable sources';

  protected render(distributions: readonly DatasetDistribution[]): void {
    cli.table(distributions as DatasetDistribution[], {
      distributionTitle: {
        header: 'Source Name',
        get: (distribution: DatasetDistribution) => distribution.dataset.name,
      },
      distributionId: {
        header: 'Source URI',
        get: (distribution: DatasetDistribution) =>
          distribution.distribution.iri.toString(),
      },
    });
  }

  async run(): Promise<void> {
    const catalog = await Catalog.default();
    const distributions = catalog.datasets.flatMap((dataset: Dataset) =>
      dataset.distributions.map(distribution => ({
        dataset,
        distribution,
      }))
    );

    this.render(distributions);
  }
}
