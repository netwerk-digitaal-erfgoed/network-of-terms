import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {Resource} from '@opentelemetry/resources';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-proto';
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions';
import {metrics, ValueType} from '@opentelemetry/api';

const meterProvider = new MeterProvider({
  resource: Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'network-of-terms',
    })
  ),
});
meterProvider.addMetricReader(
  new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 60000,
  })
);
metrics.setGlobalMeterProvider(meterProvider);

const meter = metrics.getMeter('default');

export const clientQueriesCounter = meter.createCounter(
  'queries.client.counter',
  {
    description: 'Number of user queries',
    valueType: ValueType.INT,
  }
);

export const sourceQueriesHistogram = meter.createHistogram(
  'queries.source.counter',
  {
    description: 'Queries to terminology sources and their response times',
  }
);
