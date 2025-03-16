import { diag } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader, MetricReader } from '@opentelemetry/sdk-metrics';

/**
 * Metrics Configuration
 * 
 * This module configures the metrics exporter for OpenTelemetry
 * and provides utilities for metrics collection.
 */

/**
 * Get a configured metrics reader for periodic export
 * 
 * Creates and configures a PeriodicExportingMetricReader that exports
 * metrics to the configured endpoint on a regular interval.
 * 
 * @param options Optional configuration parameters
 * @param options.intervalMillis Export interval in milliseconds (default: 15000)
 * @returns Configured PeriodicExportingMetricReader ready for use
 */
export function getMetricsReader(options?: { intervalMillis?: number }): MetricReader {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
    const intervalMillis = options?.intervalMillis || 15000;
    
    diag.info(`[TELEMETRY] Configuring metrics exporter with interval ${intervalMillis}ms`);
    
    // Use type assertion to overcome private property conflict
    return new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            url: endpoint, // For gRPC, we don't need to specify the path
        }),
        exportIntervalMillis: intervalMillis,
    }) as unknown as MetricReader;
}

/**
 * Configure metrics-related environment variables
 * 
 * Sets up standard environment variables for metrics configuration
 * to ensure consistent behavior across the application.
 */
export function configureMetricsEnvironment(): void {
    // Configure environment variables for metrics
    process.env.OTEL_METRICS_EXPORTER = 'otlp';
} 