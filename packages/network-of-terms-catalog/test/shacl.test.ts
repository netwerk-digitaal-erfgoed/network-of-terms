import {JsonLdParser} from 'jsonld-streaming-parser';
import * as fs from 'fs';
import rdf from 'rdf-ext';
import SHACLValidator from 'rdf-validate-shacl';
import ValidationReport from 'rdf-validate-shacl';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import {DatasetCore} from '@rdfjs/types';

describe('Dataset', () => {
  it('validates against SHACL', async () => {
    const datasets = listDatasets();

    const validator = await shaclValidator();
    const jsonLdParser = new JsonLdParser();
    const base = await rdf
      .dataset()
      .import(
        fs
          .createReadStream(catalogPath + '/publishers.jsonld')
          .pipe(jsonLdParser)
      );

    for (const dataset of datasets) {
      const jsonLdParser = new JsonLdParser();
      const data = (
        await rdf
          .dataset()
          .import(
            fs
              .createReadStream(catalogPath + '/datasets/' + dataset)
              .pipe(jsonLdParser)
          )
      ).addAll(base);
      expect(containsDatasetNode(data)).toBe(true);

      const report = await validator.validate(data);
      expect(report).toConform();
    }
  });
});

const listDatasets = () => fs.readdirSync(catalogPath + '/datasets');

const containsDatasetNode = (data: DatasetCore): boolean =>
  data.match(
    null,
    rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    rdf.namedNode('http://schema.org/Dataset')
  ).size > 0;

const shaclValidator = async (): Promise<typeof SHACLValidator> => {
  const jsonLdParser = new JsonLdParser();
  const shapes = await rdf
    .dataset()
    .import(jsonLdParser.import(fs.createReadStream(shaclPath)));
  return new SHACLValidator(shapes);
};

expect.extend({
  toConform(report: typeof ValidationReport) {
    return {
      pass: report.conforms,
      message: () =>
        report.results.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result: any) =>
            result.message +
            ' for ' +
            result.path.value +
            ' at ' +
            result.focusNode.value
        ),
    };
  },
});

const catalogPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../catalog'
);
const shaclPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../shacl/dataset.jsonld'
);
