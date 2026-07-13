// Minimal W3C Trace Context boundary for dependency-free hosted tracing. The
// AsyncLocalStorage context survives awaited provider calls, so JSON span records and
// the optional Bedrock client share one trace without logging request content.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: string;
}

interface ParsedParent {
  traceId: string;
  spanId: string;
  traceFlags: string;
}

const storage = new AsyncLocalStorage<TraceContext>();
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

/** Parse the supported W3C traceparent version, rejecting zero/invalid identifiers. */
export function parseTraceparent(value: string | readonly string[] | undefined): ParsedParent | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const match = TRACEPARENT.exec(candidate.trim());
  if (!match || match[1] === ZERO_TRACE_ID || match[2] === ZERO_SPAN_ID) return null;
  return { traceId: match[1]!, spanId: match[2]!, traceFlags: match[3]! };
}

export function startServerTrace(value: string | readonly string[] | undefined): TraceContext {
  const parent = parseTraceparent(value);
  return {
    traceId: parent?.traceId ?? randomHex(16),
    spanId: randomHex(8),
    ...(parent ? { parentSpanId: parent.spanId } : {}),
    traceFlags: parent?.traceFlags ?? "01",
  };
}

export function runWithTrace<T>(context: TraceContext, operation: () => T): T {
  return storage.run(context, operation);
}

/** Create a client/internal child while retaining the current trace identifier. */
export function runInChildTrace<T>(operation: () => T): T {
  const parent = storage.getStore();
  const child: TraceContext = {
    traceId: parent?.traceId ?? randomHex(16),
    spanId: randomHex(8),
    ...(parent ? { parentSpanId: parent.spanId } : {}),
    traceFlags: parent?.traceFlags ?? "01",
  };
  return storage.run(child, operation);
}

export function currentTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

export function currentTraceparent(): string | undefined {
  const context = storage.getStore();
  return context
    ? `00-${context.traceId}-${context.spanId}-${context.traceFlags}`
    : undefined;
}

/** Low-cardinality, content-minimized fields accepted by the allowlist log sink. */
export function currentTraceLogFields(): Record<string, string> {
  const context = storage.getStore();
  if (!context) return {};
  return {
    trace_id: context.traceId,
    span_id: context.spanId,
    ...(context.parentSpanId ? { parent_span_id: context.parentSpanId } : {}),
    trace_flags: context.traceFlags,
  };
}
