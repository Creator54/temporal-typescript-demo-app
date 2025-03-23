import { diag } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader, MetricReader } from '@opentelemetry/sdk-metrics';

/**
 * Configures and manages OpenTelemetry metrics export for Temporal.
 * This class provides:
 * 1. OTLP metrics exporter configuration
 * 2. Periodic metrics reader setup
 */

/**
 * Configure metrics-related environment variables
 * 
 * Sets up standard environment variables for metrics configuration
 * to ensure consistent behavior across the application.
 */
export function configureMetricsEnvironment(): void {
    // Configure environment variables for metrics if not already set
    if (!process.env.OTEL_METRICS_EXPORTER) {
        process.env.OTEL_METRICS_EXPORTER = 'otlp';
    }
    
    if (!process.env.OTEL_EXPORTER_OTLP_PROTOCOL) {
        process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
    }
    
    if (!process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        // Use the generic endpoint for metrics if specific one not set
        process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    }
    
    // Force temporality to match Java app
    process.env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE = 'cumulative';
    
    diag.info('Metrics environment configured');
}

/**
 * Gets a configured metrics reader for periodic export.
 * Creates a reader that periodically exports metrics via OTLP.
 * 
 * @param options Optional configuration parameters
 * @return Configured metric reader ready for use
 */
export function getMetricsReader(options?: { intervalMillis?: number }): MetricReader {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
    const intervalMillis = options?.intervalMillis || 5000; // Match Java's default 5s interval
    
    console.log(`[METRICS] Configuring metrics reader with endpoint ${endpoint} and interval ${intervalMillis}ms`);
    
    // Get OpenTelemetry headers from environment variables
    const headers = getOtelHeaders();
    const headerKeys = Object.keys(headers);
    if (headerKeys.length > 0) {
        console.log(`[METRICS] Using headers: ${headerKeys.join(', ')}`);
    }
    
    // Create OTLP gRPC exporter
    const exporter = new OTLPMetricExporter({
        url: endpoint,
        timeoutMillis: 15000,
        headers: headers // Include any headers from env variables
    });
    
    // Create periodic reader with configured interval
    const reader = new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: intervalMillis,
        exportTimeoutMillis: Math.floor(intervalMillis * 0.8) // Set timeout to 80% of interval to ensure it's always less
    });
    
    return reader;
}

/**
 * Get the standard OpenTelemetry headers.
 * Extracts headers from environment variables if available.
 * 
 * @return Headers object for exporters
 */
export function getOtelHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Extract headers from environment variables
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('OTEL_EXPORTER_OTLP_HEADERS_')) {
            const headerName = key.replace('OTEL_EXPORTER_OTLP_HEADERS_', '').toLowerCase();
            headers[headerName] = process.env[key] || '';
        }
    });
    
    return headers;
}

export default {
    getMetricsReader,
    getOtelHeaders,
    configureMetricsEnvironment
}; 