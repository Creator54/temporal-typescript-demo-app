import { NodeSDK } from '@opentelemetry/sdk-node';
import { SpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterGrpc } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider } from '@opentelemetry/sdk-logs';

// Default OpenTelemetry endpoint for SigNoz cloud
// Available regions:
// - US: ingest.us.signoz.cloud:443
// - EU: ingest.eu.signoz.cloud:443
// - IN: ingest.in.signoz.cloud:443
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://ingest.in.signoz.cloud:443';
const OTEL_RESOURCE_ATTRIBUTES = process.env.OTEL_RESOURCE_ATTRIBUTES || 'service.name=temporal-hello-world';

function extractKeyValues(str: string, delimiter = ',', keyValueSeparator = '='): { [key: string]: string } {
  if (!str) return {};

  const result: { [key: string]: string } = {};
  for (const pair of str.split(delimiter)) {
    const [key, value] = pair.split(keyValueSeparator);
    if (key && value) {
      result[key.trim()] = value.trim();
    }
  }
  return result;
}

// Extract resource attributes
const resourceAttributes = extractKeyValues(OTEL_RESOURCE_ATTRIBUTES);

// Parse headers directly from OTEL_EXPORTER_OTLP_HEADERS
const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS
  ? extractKeyValues(process.env.OTEL_EXPORTER_OTLP_HEADERS)
  : undefined;

function setupTraceExporter(): SpanExporter | undefined {
  console.log('[Instrumentation] Setting up Trace Exporter to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new OTLPTraceExporterGrpc({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    timeoutMillis: 1000,
    headers
  });
}

function setupMetricReader() {
  console.log('[Instrumentation] Setting up Metric Reader to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporterGrpc({
      url: OTEL_EXPORTER_OTLP_ENDPOINT,
      timeoutMillis: 1000,
      headers
    }),
  });
}

function setupLogExporter() {
  console.log('[Instrumentation] Setting up Log Exporter to', OTEL_EXPORTER_OTLP_ENDPOINT);
  return new OTLPLogExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    timeoutMillis: 1000,
    headers
  });
}

export const resource = new Resource(resourceAttributes);

export const traceExporter = setupTraceExporter();
const metricReader = setupMetricReader();
const logExporter = setupLogExporter();

const loggerProvider = new LoggerProvider({ resource });
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));
logs.setGlobalLoggerProvider(loggerProvider);

export const otelSdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [getNodeAutoInstrumentations()],
});

otelSdk.start();
