import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const baselineUrl = __ENV.BASELINE_URL;
const pqcUrl = __ENV.PQC_URL;

const handshake = new Trend('handshake_ms');
const total = new Trend('total_ms');

export let options = {
  vus: 10,
  duration: '1m',
};

function run(url, label) {
  const res = http.get(url, { tags: { endpoint: label } });
  check(res, {
    [`status 200 ${label}`]: (r) => r.status === 200,
  });

  // k6 does not expose handshake directly; approximate via timing breakdown
  // (connect + tls_handshake if available). Older k6 versions may not expose
  // tls_handshake; total still useful for comparing relative impact.
  const t = res.timings;
  const hs = (t.connecting || 0) + (t.tls_handshake || 0);
  handshake.add(hs, { endpoint: label });
  total.add(t.duration, { endpoint: label });
}

export default function () {
  if (baselineUrl) run(baselineUrl, 'baseline');
  if (pqcUrl) run(pqcUrl, 'pqc');
  sleep(1);
}
