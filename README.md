# PQC TLS Test Scaffold

Quick scaffolding to stand up the baseline vs PQ endpoints and client tests.

## 1) Backend echo service (Lambda + HTTP API)
- Create a Lambda function (Python 3.11) with handler `echo_lambda.handler`.
- Use `backend/echo_lambda.py` as the function code; it echoes headers, method, path, and timestamps.
- Create an API Gateway **HTTP API** and integrate it with the Lambda (proxy integration).
- Enable CORS if the Android app uses XHR/fetch.
- Keep the backend region in ap-southeast-1 to align with the PQ terminator fallback.

## 2) Certificates and domains
- Request two ACM certs (DNS-validated):
  - `baseline.example.com`
  - `pqc.example.com`
- For CloudFront: request the certs in `us-east-1`.
- For ALB/NLB in Singapore: request certs in `ap-southeast-1`.

## 3) Edge endpoints
- **Baseline:** ALB or CloudFront with standard TLS policy (TLS 1.2/1.3) pointing to the same backend.
- **PQC:** 
  - If CloudFront PQ is available in your account, create a second distribution with the PQ-enabled security policy.
  - Otherwise, deploy NLB (TCP) -> EC2 running PQ-enabled nginx/s2n-tls. Use the same origin app target group as the baseline (or forward TCP to app if terminating at nginx).
- Route 53:
  - `baseline.example.com` -> baseline edge endpoint.
  - `pqc.example.com` -> PQ endpoint.

## 4) Android harness outline
- Two buttons/flows: call baseline vs PQ URLs.
- Use OkHttp with `EventListener` to record DNS, connect, TLS handshake, TTFB, total latency, negotiated protocol/cipher, and failures.
- Log to file or POST results to your backend for aggregation.
- For older Android, optionally bundle Conscrypt to widen TLS support; expect PQ failures on very old stacks.

## 5) Synthetic load (k6)
- Use `scripts/k6-baseline-vs-pqc.js` as a starting point; set `BASELINE_URL` and `PQC_URL` env vars.
- Capture handshake/latency deltas and failure rates from a stable network.

## 6) Observability
- Enable access logs (CloudFront/ALB/NLB+nginx) to S3 with TLS fields.
- CloudWatch metrics for latency/error rates; optional VPC Flow Logs for connection-level visibility.

## Next actions (in order)
1) Deploy the Lambda echo and HTTP API (backend/echo_lambda.py).
2) Request ACM certs for both hostnames (correct regions).
3) Check CloudFront PQ toggle availability; choose CloudFront PQ vs NLB+PQ EC2 path.
4) Stand up the two endpoints and Route 53 records.
5) Implement Android harness and run initial measurements; run k6 for synthetic baselines.
