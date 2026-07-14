import assert from "node:assert/strict";
import { test } from "node:test";

import {
  currentTraceContext,
  currentTraceLogFields,
  currentTraceparent,
  parseTraceparent,
  runInChildTrace,
  runWithTrace,
  startServerTrace,
} from "../api/trace.ts";

const TRACE_ID = "0123456789abcdef0123456789abcdef";
const PARENT_ID = "0123456789abcdef";

test("valid W3C traceparent is continued with a fresh server span", () => {
  const context = startServerTrace(`00-${TRACE_ID}-${PARENT_ID}-01`);
  assert.equal(context.traceId, TRACE_ID);
  assert.equal(context.parentSpanId, PARENT_ID);
  assert.match(context.spanId, /^[0-9a-f]{16}$/);
  assert.notEqual(context.spanId, PARENT_ID);
});

test("invalid and zero traceparents are rejected", () => {
  assert.equal(parseTraceparent("not-a-trace"), null);
  assert.equal(parseTraceparent(`00-${"0".repeat(32)}-${PARENT_ID}-01`), null);
  assert.equal(parseTraceparent(`00-${TRACE_ID}-${"0".repeat(16)}-01`), null);
  const root = startServerTrace("not-a-trace");
  assert.match(root.traceId, /^[0-9a-f]{32}$/);
  assert.equal(root.parentSpanId, undefined);
});

test("child spans retain trace identity across async work", async () => {
  const server = startServerTrace(`00-${TRACE_ID}-${PARENT_ID}-00`);
  await runWithTrace(server, async () => {
    assert.equal(currentTraceContext(), server);
    assert.equal(currentTraceparent(), `00-${TRACE_ID}-${server.spanId}-00`);
    await runInChildTrace(async () => {
      await Promise.resolve();
      const child = currentTraceContext()!;
      assert.equal(child.traceId, TRACE_ID);
      assert.equal(child.parentSpanId, server.spanId);
      assert.notEqual(child.spanId, server.spanId);
      assert.deepEqual(currentTraceLogFields(), {
        trace_id: TRACE_ID,
        span_id: child.spanId,
        parent_span_id: server.spanId,
        trace_flags: "00",
      });
    });
    assert.equal(currentTraceContext(), server);
  });
  assert.equal(currentTraceContext(), undefined);
});
