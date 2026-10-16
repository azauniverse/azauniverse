import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'summaries';
const expectedShards = Number.parseInt(process.argv[3] || '8', 10);
const targetPerShard = Number.parseInt(process.argv[4] || '500', 10);
const expectedSessions = expectedShards * targetPerShard;
const problems = [];
const reports = [];

function requireMetric(summary, name, shard) {
  const metric = summary?.metrics?.[name];
  if (!metric || typeof metric !== 'object') {
    problems.push(`Shard ${shard}: missing metric ${name}`);
    return null;
  }
  return metric;
}

function metricValues(metric) {
  if (!metric || typeof metric !== 'object') return null;
  return metric.values && typeof metric.values === 'object' ? metric.values : metric;
}

function readRate(summary, name, shard) {
  const metric = requireMetric(summary, name, shard);
  if (!metric) return null;
  const values = metricValues(metric);
  const truthy = Number(values.passes);
  const falsy = Number(values.fails);
  if (!Number.isFinite(truthy) || !Number.isFinite(falsy) || truthy < 0 || falsy < 0) {
    problems.push(`Shard ${shard}: malformed rate values for ${name}`);
    return null;
  }
  const samples = truthy + falsy;
  return { truthy, falsy, samples, rate: samples > 0 ? truthy / samples : NaN };
}

function readCount(summary, name, shard) {
  const metric = requireMetric(summary, name, shard);
  if (!metric) return null;
  const count = Number(metricValues(metric)?.count);
  if (!Number.isFinite(count) || count < 0) {
    problems.push(`Shard ${shard}: malformed counter value for ${name}`);
    return null;
  }
  return count;
}

let files;
try {
  files = fs.readdirSync(dir).filter((name) => /^summary-\d+\.json$/.test(name));
} catch (error) {
  console.error(`Cannot read summary directory ${dir}: ${error.message}`);
  process.exit(1);
}

if (files.length !== expectedShards) {
  problems.push(`Expected ${expectedShards} shard summaries, found ${files.length}`);
}

for (let shard = 1; shard <= expectedShards; shard += 1) {
  const fullPath = path.join(dir, `summary-${shard}.json`);
  if (!fs.existsSync(fullPath)) {
    problems.push(`Missing summary-${shard}.json`);
    continue;
  }

  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    problems.push(`Shard ${shard}: invalid JSON summary (${error.message})`);
    continue;
  }

  const handshake = readRate(summary, 'ws_handshake_ok', shard);
  const initial = readRate(summary, 'ws_initial_state_ok', shard);
  const errors = readRate(summary, 'ws_error_rate', shard);
  const early = readRate(summary, 'ws_early_close_rate', shard);
  const admitted = readCount(summary, 'ws_admitted', shard);
  const queued = readCount(summary, 'ws_queued', shard);
  const p95Raw = metricValues(requireMetric(summary, 'ws_initial_state_ms', shard))?.['p(95)'];
  const p95 = Number(p95Raw);
  const pongs = readCount(summary, 'ws_pongs', shard);

  if (handshake && handshake.samples !== targetPerShard) {
    problems.push(`Shard ${shard}: expected ${targetPerShard} handshake samples, got ${handshake.samples}`);
  }
  if (initial && initial.samples !== targetPerShard) {
    problems.push(`Shard ${shard}: expected ${targetPerShard} initial-state samples, got ${initial.samples}`);
  }
  if (admitted !== null && admitted !== targetPerShard) {
    problems.push(`Shard ${shard}: expected ${targetPerShard} admitted sessions, got ${admitted}`);
  }
  if (queued !== null && queued !== 0) {
    problems.push(`Shard ${shard}: expected zero queued sessions, got ${queued}`);
  }
  if (!Number.isFinite(p95)) {
    problems.push(`Shard ${shard}: missing/invalid p(95) initial-state latency`);
  } else if (p95 >= 8000) {
    problems.push(`Shard ${shard}: p(95) initial-state latency ${p95}ms is not below 8000ms`);
  }

  reports.push({ shard, handshake, initial, errors, early, admitted, queued, p95, pongs });
}

function sumRate(key) {
  let truthy = 0;
  let falsy = 0;
  for (const report of reports) {
    const rate = report[key];
    if (!rate) continue;
    truthy += rate.truthy;
    falsy += rate.falsy;
  }
  const samples = truthy + falsy;
  return { events: truthy, samples, rate: samples > 0 ? truthy / samples : NaN };
}

const handshake = sumRate('handshake');
const initial = sumRate('initial');
const errors = sumRate('errors');
const early = sumRate('early');
const admittedTotal = reports.reduce((sum, report) => sum + (report.admitted ?? 0), 0);
const queuedTotal = reports.reduce((sum, report) => sum + (report.queued ?? 0), 0);
const maxShardP95 = reports.reduce((max, report) => Number.isFinite(report.p95) ? Math.max(max, report.p95) : max, 0);
const pongsTotal = reports.reduce((sum, report) => sum + (report.pongs ?? 0), 0);

console.log(`\n=== AZA ${expectedSessions}-session aggregate report (production) ===`);
console.log(`Expected shard summaries: ${expectedShards}; found: ${files.length}`);
console.log(`Expected total sessions: ${expectedSessions}; admitted: ${admittedTotal}; queued: ${queuedTotal}`);
console.log(`Handshake success: ${handshake.events}/${handshake.samples} (${(handshake.rate * 100).toFixed(3)}%)`);
console.log(`Initial state received: ${initial.events}/${initial.samples} (${(initial.rate * 100).toFixed(3)}%)`);
console.log(`Unexpected-error rate: ${errors.events}/${errors.samples} (${(errors.rate * 100).toFixed(3)}%)`);
console.log(`Early-close rate: ${early.events}/${early.samples} (${(early.rate * 100).toFixed(3)}%)`);
console.log(`Highest shard p(95) initial-state latency: ${maxShardP95.toFixed(2)}ms`);
console.log(`WebSocket pong replies received: ${pongsTotal}`);
for (const report of reports) {
  const errorPct = report.errors?.rate === undefined ? 'n/a' : `${(report.errors.rate * 100).toFixed(3)}%`;
  const closePct = report.early?.rate === undefined ? 'n/a' : `${(report.early.rate * 100).toFixed(3)}%`;
  console.log(`Shard ${report.shard}: errors=${errorPct}, early-close=${closePct}, p95=${Number.isFinite(report.p95) ? `${report.p95}ms` : 'n/a'}`);
}

if (admittedTotal !== expectedSessions) problems.push(`Expected ${expectedSessions} total admitted sessions, got ${admittedTotal}`);
if (queuedTotal !== 0) problems.push(`Expected zero queued sessions overall, got ${queuedTotal}`);
if (!(handshake.rate > 0.99)) problems.push(`Aggregate WebSocket handshake success must be >99%, got ${(handshake.rate * 100).toFixed(3)}%`);
if (!(initial.rate > 0.99)) problems.push(`Aggregate initial-state success must be >99%, got ${(initial.rate * 100).toFixed(3)}%`);
if (!(errors.rate < 0.005)) problems.push(`Aggregate unexpected-error rate must be <0.5%, got ${(errors.rate * 100).toFixed(3)}%`);
if (!(early.rate < 0.005)) problems.push(`Aggregate early-close rate must be <0.5%, got ${(early.rate * 100).toFixed(3)}%`);

if (problems.length) {
  console.error('\nFAIL: aggregate checks did not pass:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS: all aggregate ${expectedSessions}-session thresholds met.`);
}
