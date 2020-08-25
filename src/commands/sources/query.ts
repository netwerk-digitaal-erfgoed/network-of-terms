import {cli} from 'cli-ux';
import {Command, flags} from '@oclif/command';
import {DistributionsService} from '../../services/distributions';
import * as Logger from '../../helpers/logger';
import {QueryResult} from '../../services/query';
import * as RDF from 'rdf-js';
import {Term} from '../../services/terms';
import {Catalog, IRI} from '@netwerk-digitaal-erfgoed/network-of-terms-catalog';
import {newEngine} from '@comunica/actor-init-sparql';

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
    distributions: flags.string({
      description:
        'URIs of distributions to query, comma-separated, e.g. "https://www.wikidata.org/sparql,https://data.netwerkdigitaalerfgoed.nl/rkd/rkdartists/sparql"',
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

  protected render(results: QueryResult[], catalog: Catalog): void {
    const rowsPerDistribution = results.map((result: QueryResult): Row[] => {
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
    const sources = flags.distributions
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
    });
    this.render(results, catalog);
  }
}
