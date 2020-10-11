/// <reference types="node" />
import * as RDF from 'rdf-js';
import { URL } from 'url';
export declare class Catalog {
    readonly datasets: ReadonlyArray<Dataset>;
    constructor(datasets: ReadonlyArray<Dataset>);
    static default(): Promise<Catalog>;
    static fromStore(store: RDF.Store[]): Promise<Catalog>;
    getDatasetByDistributionIri(iri: IRI): Dataset | undefined;
}
export declare class Dataset {
    readonly iri: IRI;
    readonly name: string;
    readonly creators: [Organization];
    readonly distributions: [Distribution];
    readonly alternateName?: string | undefined;
    constructor(iri: IRI, name: string, creators: [Organization], distributions: [Distribution], alternateName?: string | undefined);
    getDistributionByIri(iri: IRI): Distribution | undefined;
}
export declare class Organization {
    readonly iri: IRI;
    readonly name: string;
    readonly alternateName: string;
    constructor(iri: IRI, name: string, alternateName: string);
}
export declare class SparqlDistribution {
    readonly iri: IRI;
    readonly endpoint: IRI;
    readonly query: string;
    constructor(iri: IRI, endpoint: IRI, query: string);
}
/**
 * A union type to be extended in the future with other distribution types.
 */
export declare type Distribution = SparqlDistribution;
export declare class IRI extends URL {
}
/**
 * Return a separate RDF.Store for each catalog file because merging them into a single store
 * causes blank nodes to be re-used instead of incremented when adding the next file.
 */
export declare function fromFiles(directory: string): Promise<RDF.Store[]>;
