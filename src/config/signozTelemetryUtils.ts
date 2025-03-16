import { diag, trace, metrics, Tracer, Meter, context } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * SignOz Telemetry Utilities
 * 
 * This module provides central access to tracer and meter instances
 * and manages the OpenTelemetry SDK lifecycle for SigNoz integration.
 */

// Store SDK instances for direct access
let sdkInstance: NodeSDK | null = null;
let tracerInstance: Tracer | null = null;
let meterInstance: Meter | null = null;

/**
 * Get the configured tracer instance
 * 
 * Returns the cached tracer instance if available, or creates a new one.
 * This ensures consistent tracing behavior throughout the application.
 * 
 * @returns OpenTelemetry Tracer instance
 */
export function getTracer(): Tracer {
    if (!tracerInstance) {
        diag.warn('[TELEMETRY] No tracer instance available, creating a new one');
        tracerInstance = trace.getTracer('temporal-hello-world');
    }
    return tracerInstance;
}

/**
 * Get the configured meter instance
 * 
 * Returns the cached meter instance if available, or creates a new one.
 * This ensures consistent metrics collection throughout the application.
 * 
 * @returns OpenTelemetry Meter instance
 */
export function getMeter(): Meter {
    if (!meterInstance) {
        diag.warn('[TELEMETRY] No meter instance available, creating a new one');
        meterInstance = metrics.getMeter('temporal-hello-world');
    }
    return meterInstance;
}

/**
 * Store the OpenTelemetry SDK instance for later access
 * 
 * @param sdk The SDK instance to store
 */
export function setOpenTelemetrySdk(sdk: NodeSDK): void {
    sdkInstance = sdk;
}

/**
 * Get the current OpenTelemetry SDK instance
 * 
 * Provides access to the underlying SDK for advanced configuration.
 * Use with caution as direct manipulation can affect the entire application.
 * 
 * @returns The current NodeSDK instance or null if not initialized
 */
export function getOpenTelemetrySdk(): NodeSDK | null {
    return sdkInstance;
}

/**
 * Force export of any pending spans
 * 
 * Use this function during shutdown to ensure all telemetry data is exported
 * before the process exits. This helps prevent data loss.
 * 
 * @returns Promise that resolves when export is complete or times out
 */
export async function forceSpanExport(): Promise<boolean> {
    diag.info('[TELEMETRY] Forcing export of pending spans');
    
    if (!sdkInstance) {
        diag.warn('[TELEMETRY] No SDK instance available, nothing to export');
        return false;
    }
    
    // Create a promise that times out after 3 seconds
    const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
            diag.warn('[TELEMETRY] Span export timed out after 3 seconds');
            resolve(false);
        }, 3000);
    });
    
    // Create a promise for the shutdown
    const shutdownPromise = sdkInstance.shutdown().then(() => {
        diag.info('[TELEMETRY] SDK shutdown complete, spans exported');
        return true;
    }).catch(err => {
        diag.error('[TELEMETRY] Error during SDK shutdown:', err);
        return false;
    });
    
    // Return the first promise that resolves
    return Promise.race([shutdownPromise, timeoutPromise]);
} 