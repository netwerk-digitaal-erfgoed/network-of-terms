"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromFiles = exports.IRI = exports.SparqlDistribution = exports.Organization = exports.Dataset = exports.Catalog = void 0;
const fs_1 = __importDefault(require("fs"));
const rdf_parse_1 = __importDefault(require("rdf-parse"));
const actor_init_sparql_rdfjs_1 = require("@comunica/actor-init-sparql-rdfjs");
const stream_1 = require("stream");
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const globby_1 = __importDefault(require("globby"));
const rdf_store_stream_1 = require("rdf-store-stream");
class Catalog {
    constructor(datasets) {
        this.datasets = datasets;
    }
    static async default() {
        const directory = path_1.default.resolve(__dirname, '../', 'catalog/');
        const store = await fromFiles(directory);
        return this.fromStore(store);
    }
    static async fromStore(store) {
        const query = `
      PREFIX schema: <http://schema.org/>
        SELECT * WHERE {
          ?dataset a schema:Dataset ;
            schema:name ?name ;
            schema:creator ?creator ;
            schema:distribution ?distribution .
          OPTIONAL { ?dataset schema:alternateName ?alternateName . }
          ?creator schema:name ?creatorName ;  
            schema:alternateName ?creatorAlternateName .
          ?distribution schema:encodingFormat "application/sparql-query" ;
            schema:contentUrl ?endpointUrl ;
            schema:potentialAction/schema:query ?query .
        }
        ORDER BY LCASE(?name)`;
        const result = (await actor_init_sparql_rdfjs_1.newEngine().query(query, {
            sources: store,
        }));
        const promise = new Promise((resolve, reject) => {
            const datasets = [];
            result.bindingsStream.on('data', (bindings) => {
                datasets.push(new Dataset(new IRI(bindings.get('?dataset').value), bindings.get('?name').value, [
                    new Organization(new IRI(bindings.get('?creator').value), bindings.get('?creatorName').value, bindings.get('?creatorAlternateName').value),
                ], [
                    new SparqlDistribution(new IRI(bindings.get('?distribution').value), new IRI(bindings.get('?endpointUrl').value), bindings.get('?query').value),
                ], bindings.get('?alternateName')
                    ? bindings.get('?alternateName').value
                    : undefined));
            });
            result.bindingsStream.on('end', () => resolve(datasets));
            result.bindingsStream.on('error', () => reject);
        });
        return new Catalog(await promise);
    }
    getDatasetByDistributionIri(iri) {
        return this.datasets.find(dataset => dataset.getDistributionByIri(iri) !== undefined);
    }
}
exports.Catalog = Catalog;
class Dataset {
    constructor(iri, name, creators, distributions, alternateName) {
        this.iri = iri;
        this.name = name;
        this.creators = creators;
        this.distributions = distributions;
        this.alternateName = alternateName;
    }
    getDistributionByIri(iri) {
        return this.distributions.find(distribution => distribution.iri.toString() === iri.toString());
    }
}
exports.Dataset = Dataset;
class Organization {
    constructor(iri, name, alternateName) {
        this.iri = iri;
        this.name = name;
        this.alternateName = alternateName;
    }
}
exports.Organization = Organization;
class SparqlDistribution {
    constructor(iri, endpoint, query) {
        this.iri = iri;
        this.endpoint = endpoint;
        this.query = query;
    }
}
exports.SparqlDistribution = SparqlDistribution;
class IRI extends url_1.URL {
}
exports.IRI = IRI;
/**
 * Return a separate RDF.Store for each catalog file because merging them into a single store
 * causes blank nodes to be re-used instead of incremented when adding the next file.
 */
async function fromFiles(directory) {
    // Read all files except those in the queries/ directory.
    const files = await globby_1.default([directory, '!' + directory + '/queries']);
    return Promise.all(files.map(file => {
        const quadStream = rdf_parse_1.default.parse(fs_1.default.createReadStream(file), {
            path: file,
        }).pipe(new InlineFiles());
        return rdf_store_stream_1.storeStream(quadStream);
    }));
}
exports.fromFiles = fromFiles;
/**
 * An RDF.Quad transform that inlines file://... references in the quad's object value.
 */
class InlineFiles extends stream_1.Transform {
    constructor() {
        super({ objectMode: true });
    }
    async _transform(quad, encoding, callback) {
        if (quad.object.value.startsWith('file://')) {
            const file = path_1.default.resolve(__dirname, '../', quad.object.value.substr(7));
            quad.object.value = await fs_1.default.promises.readFile(file, 'utf-8');
        }
        this.push(quad, encoding);
        callback();
    }
}
//# sourceMappingURL=catalog.js.map