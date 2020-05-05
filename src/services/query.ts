import { ActorInitSparql } from '@comunica/actor-init-sparql/lib/ActorInitSparql-browser';
import {
  Bindings,
  IActorQueryOperationOutputQuads,
} from '@comunica/bus-query-operation';
import { literal } from '@rdfjs/data-model';
import { LoggerPino } from '../helpers/logger-pino';
import { Term } from '../services/term';
import * as ComunicaHdt from '@comunica/actor-init-sparql-hdt';
import * as ComunicaSparql from '@comunica/actor-init-sparql';
import * as Hoek from '@hapi/hoek';
import * as Joi from '@hapi/joi';
import * as Logger from '../helpers/logger';
import * as Pino from 'pino';
import * as PrettyMilliseconds from 'pretty-ms';
import * as RDF from 'rdf-js';

export interface ConstructorOptions {
  logLevel: string;
  accessServiceType: string;
  endpointUrl: string;
  searchTerms: string;
  query: string;
}

const schemaConstructor = Joi.object({
  logLevel: Joi.string().required(),
  accessServiceType: Joi.string().required(),
  endpointUrl: Joi.string().required(),
  searchTerms: Joi.string().required(),
  query: Joi.string().required(),
});

export class QueryService {
  protected logger: Pino.Logger;
  protected accessServiceType: string;
  protected endpointUrl: string;
  protected searchTerms: string;
  protected query: string;
  protected engine: ActorInitSparql;
  protected readonly accessServiceTypes: { [key: string]: string } = {
    'http://netwerkdigitaalerfgoed.nl/ontologies/accessServiceTypes/hdt':
      'hdtFile',
    'http://netwerkdigitaalerfgoed.nl/ontologies/accessServiceTypes/fragments':
      'hypermedia',
    'http://netwerkdigitaalerfgoed.nl/ontologies/accessServiceTypes/sparql':
      'sparql',
  };

  constructor(options: ConstructorOptions) {
    const args = Joi.attempt(options, schemaConstructor);
    this.logger = Logger.getLogger({
      name: this.constructor.name,
      level: args.logLevel,
    });
    const accessServiceType = this.accessServiceTypes[args.accessServiceType];
    if (accessServiceType === undefined) {
      throw Error(`Unknown access service type: "${args.accessServiceType}"`);
    }
    this.accessServiceType = accessServiceType;
    this.endpointUrl = args.endpointUrl;
    this.searchTerms = args.searchTerms;
    this.query = args.query;

    if (accessServiceType === 'hdtFile') {
      this.engine = ComunicaHdt.newEngine();
    } else {
      this.engine = ComunicaSparql.newEngine();
    }
  }

  // tslint:disable-next-line:no-any
  protected getConfig(): any {
    const logger = new LoggerPino({ logger: this.logger });
    const config = {
      log: logger,
      sources: [
        {
          type: this.accessServiceType,
          value: this.endpointUrl,
        },
      ],
      initialBindings: Bindings({
        '?searchTerms': literal(this.searchTerms),
      }),
    };
    return config;
  }

  async run(): Promise<Term[]> {
    this.logger.info(
      `Querying "${this.endpointUrl}" with search query "${this.searchTerms}"...`
    );
    const config = this.getConfig();
    const timer = new Hoek.Bench();
    const result = (await this.engine.query(
      this.query,
      config
    )) as IActorQueryOperationOutputQuads;

    return new Promise((resolve, reject) => {
      const terms: Term[] = [];
      let term: Term;
      let subject: RDF.Quad_Subject;
      result.quadStream.on('error', reject);
      result.quadStream.on('data', (quad: RDF.Quad) => {
        const newSubject = quad.subject;
        if (!newSubject.equals(subject)) {
          subject = newSubject;
          if (term !== undefined) {
            terms.push(term);
          }
          term = new Term();
          term.id = subject;
        }
        const predicate = quad.predicate.value;
        if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
          term.type = quad.object;
        } else if (
          predicate === 'http://www.w3.org/2004/02/skos/core#prefLabel'
        ) {
          term.prefLabels.push(quad.object);
        } else if (
          predicate === 'http://www.w3.org/2004/02/skos/core#altLabel'
        ) {
          term.altLabels.push(quad.object);
        } else if (
          predicate === 'http://www.w3.org/2004/02/skos/core#hiddenLabel'
        ) {
          term.hiddenLabels.push(quad.object);
        } else if (
          predicate === 'http://www.w3.org/2004/02/skos/core#scopeNote'
        ) {
          term.scopeNotes.push(quad.object);
        } else if (
          predicate === 'http://www.w3.org/2004/02/skos/core#broader'
        ) {
          term.broaderLabels.push(quad.object);
        } else if (
          predicate === 'http://www.w3.org/2004/02/skos/core#narrower'
        ) {
          term.narrowerLabels.push(quad.object);
        }
      });
      result.quadStream.on('end', () => {
        this.logger.info(
          `Found ${terms.length} terms matching search query "${
            this.searchTerms
          }" in "${this.endpointUrl}" in ${PrettyMilliseconds(timer.elapsed())}`
        );
        resolve(terms);
      });
    });
  }
}
