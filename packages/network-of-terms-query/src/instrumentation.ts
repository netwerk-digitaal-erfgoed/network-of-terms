import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {Resource} from '@opentelemetry/resources';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-proto';
import {SEMRESATTRS_SERVICE_NAME} from '@opentelemetry/semantic-conventions';
import {metrics, ValueType} from '@opentelemetry/api';

const sourceQueriesHistogramName = 'queries.source';

const meterProvider = new MeterProvider({
  resource: Resource.default().merge(
    new Resource({
      [SEMRESATTRS_SERVICE_NAME]: 'network-of-terms',
    })
  ),
  readers:
    'test' === process.env.NODE_ENV
      ? []
      : [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis:
              (process.env.OTEL_METRIC_EXPORT_INTERVAL as unknown as number) ??
              60000,
          }),
        ],
});

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
  sourceQueriesHistogramName,
  {
    description: 'Queries to terminology sources and their response times',
    valueType: ValueType.INT,
    unit: 'ms',
  }
);
