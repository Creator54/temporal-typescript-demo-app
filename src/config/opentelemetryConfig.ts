import { Runtime } from '@temporalio/worker';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from '@opentelemetry/core';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { getMetricsReader } from './metricsExporter';
import { getTracingExporter, configureTracingEnvironment } from './tracingExporter';
import { configureMetricsEnvironment } from './metricsExporter';
import { setSDK } from './signozTelemetryUtils';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';

/**
 * OpenTelemetry Configuration
 * 
 * This module centralizes OpenTelemetry SDK setup and configuration
 * to enable consistent telemetry throughout the application.
 */

// Define incubating semantic convention attributes
const ATTR_SERVICE_NAMESPACE = 'service.namespace';
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment';

// Logger configuration state
let loggerConfigured = false;

// Track if runtime is already installed
let isRuntimeInstalled = false;

/**
 * Gets the runtime environment attributes for the application
 * Useful for OpenTelemetry resource attributes
 */
export function getRuntimeEnvironment() {
  // Get environment information from process.env
  const environment = process.env.NODE_ENV || process.env.OTEL_ENVIRONMENT || 'development';
  
  // Basic attributes
  const attributes = {
    'service.namespace': process.env.TEMPORAL_NAMESPACE || 'default',
    'deployment.region': process.env.DEPLOYMENT_REGION || 'local',
    'host.name': process.env.HOSTNAME || 'localhost',
  };
  
  return {
    environment,
    attributes
  };
}

/**
 * Configure the OpenTelemetry logger
 * 
 * Sets up the diagnostic logger for OpenTelemetry with the appropriate log level.
 * This is done only once to avoid duplicate initialization.
 * 
 * @param logLevel The log level to use (default: INFO)
 */
function configureLogger(logLevel: DiagLogLevel = DiagLogLevel.INFO): void {
    if (!loggerConfigured) {
        diag.setLogger(new DiagConsoleLogger(), logLevel);
        loggerConfigured = true;
        diag.info('[TELEMETRY] OpenTelemetry logger configured');
    }
}

/**
 * Configure OpenTelemetry environment variables
 * 
 * Sets up standard environment variables for OpenTelemetry configuration
 * to ensure consistent behavior across the application.
 * 
 * @param serviceName The name of the service for telemetry
 */
function configureEnvironmentVariables(serviceName: string): void {
    // Configure core environment variables
    process.env.OTEL_SERVICE_NAME = serviceName;
    
    // Explicitly set OTLP exporter to avoid the "exporter not available" warning
    process.env.OTEL_TRACES_EXPORTER = 'otlp';
    process.env.OTEL_METRICS_EXPORTER = 'otlp';
    
    // Set default protocol if not specified
    if (!process.env.OTEL_EXPORTER_OTLP_PROTOCOL) {
        process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
    }
    
    process.env.OTEL_PROPAGATORS = 'tracecontext,baggage';
    process.env.OTEL_LOGS_EXPORTER = 'none';
    
    // Configure tracing and metrics
    configureTracingEnvironment();
    configureMetricsEnvironment();
    
    // Log environment configuration for debugging
    diag.debug('[TELEMETRY] Environment variables:', {
        OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
        OTEL_EXPORTER_OTLP_PROTOCOL: process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
        OTEL_TRACES_EXPORTER: process.env.OTEL_TRACES_EXPORTER,
        OTEL_METRICS_EXPORTER: process.env.OTEL_METRICS_EXPORTER,
        OTEL_RESOURCE_ATTRIBUTES: process.env.OTEL_RESOURCE_ATTRIBUTES,
        OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    });
}

/**
 * Create a resource for service identification
 * 
 * Builds an OpenTelemetry resource with service identity attributes 
 * that will be attached to all telemetry.
 * 
 * @param serviceName The name of the service
 * @returns Resource instance with service identification attributes
 */
function createServiceResource(serviceName: string): Resource {
    const runtimeEnv = getRuntimeEnvironment();
    
    // Create a copy of attributes without service.namespace to avoid duplication
    const { 'service.namespace': _, ...otherAttributes } = runtimeEnv.attributes;
    
    return Resource.default().merge(
        new Resource({
            [ATTR_SERVICE_NAME]: serviceName,
            [ATTR_SERVICE_NAMESPACE]: runtimeEnv.attributes['service.namespace'],
            [ATTR_DEPLOYMENT_ENVIRONMENT]: runtimeEnv.environment,
            ...otherAttributes
        })
    );
}

/**
 * Initialize OpenTelemetry
 * 
 * Sets up the OpenTelemetry SDK with appropriate configuration for 
 * the Temporal TypeScript application.
 * 
 * @param serviceName The name of the service
 */
export async function initOpenTelemetry(serviceName: string): Promise<void> {
    // Configure the OpenTelemetry logger
    configureLogger();
    
    // Configure environment variables
    configureEnvironmentVariables(serviceName);
    
    diag.info(`[TELEMETRY] Initializing OpenTelemetry for service: ${serviceName}`);
    
    const protocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'grpc';
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
    
    diag.info(`[TELEMETRY] Configuring telemetry with ${protocol} protocol: ${endpoint}`);
    
    // Create instrumentation
    const instrumentations = getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-grpc': {
            ignoreGrpcMethods: []
        }
    });
    
    // Create trace exporter
    diag.info('[TELEMETRY] Using gRPC trace exporter');
    diag.info(`[TELEMETRY] Trace endpoint: ${endpoint}`);
    
    const traceExporter = getTracingExporter();
    
    // Create metrics reader with 5-second export interval (to match Java app)
    const metricsReader = getMetricsReader({ intervalMillis: 1000 });
    
    // Configure the SDK with explicit type casting to avoid linter errors due to library version mismatches
    const sdk = new NodeSDK({
        resource: createServiceResource(serviceName),
        traceExporter,
        instrumentations,
        spanProcessors: [],
        // @ts-ignore - Casting to avoid type errors between different OpenTelemetry package versions
        metricReader: metricsReader,
        textMapPropagator: new CompositePropagator({
            propagators: [
                new W3CTraceContextPropagator(),
                new W3CBaggagePropagator()
            ]
        })
    });
    
    // Store the SDK for later access
    setSDK(sdk);
    
    // Register SDK cleanup on process exit
    registerShutdownHandler(sdk);
    
    try {
        // Start the SDK
        await sdk.start();
        diag.info(`[TELEMETRY] OpenTelemetry SDK initialized successfully for ${serviceName}`);
    } catch (error) {
        diag.error(`[TELEMETRY] Failed to initialize OpenTelemetry SDK: ${error}`);
        throw error;
    }
    
    // Verify that metrics are enabled
    try {
        const meter = metrics.getMeter('verification');
        const counter = meter.createCounter('init_verification');
        counter.add(1, {
            'service.name': serviceName,
            'initialized': 'true'
        });
        diag.info('[TELEMETRY] Metrics recording verified successfully');
    } catch (error) {
        diag.warn(`[TELEMETRY] Failed to create verification metric: ${error}`);
    }
    
    // Install the OpenTelemetry SDK in Temporal Runtime
    try {
        await Runtime.install({
            telemetryOptions: {
                metrics: {
                    // @ts-ignore - The Temporal types may be out of date
                    enabled: true
                }
            }
        });
        diag.info('[TELEMETRY] Temporal Runtime installed with telemetry options');
    } catch (err) {
        diag.error(`[TELEMETRY] Failed to install Temporal Runtime with telemetry: ${err}`);
    }
}

/**
 * Register handlers for graceful shutdown
 * 
 * Sets up process event handlers to ensure the SDK is properly shut down
 * when the process exits, preventing telemetry data loss.
 * 
 * @param sdk The SDK instance to shut down
 */
function registerShutdownHandler(sdk: NodeSDK): void {
    // Only register for uncaught exceptions, let the worker handle SIGTERM/SIGINT
    // to prevent conflicts with multiple handlers
    
    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
        diag.error('[TELEMETRY] Uncaught exception, shutting down telemetry before exit:', error);
        
        try {
            const shutdownPromise = sdk.shutdown();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Shutdown timed out')), 5000)
            );
            
            await Promise.race([shutdownPromise, timeoutPromise]);
            diag.info('[TELEMETRY] OpenTelemetry SDK shut down successfully');
        } catch (error) {
            diag.error('[TELEMETRY] Error shutting down OpenTelemetry SDK:', 
                error instanceof Error ? error.message : String(error));
        }
    });
} 