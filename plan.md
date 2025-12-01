# TLS vs PQC Test Plan

Goal: compare baseline TLS (1.2/1.3) to TLS 1.3 with PQ/hybrid KEM on a dummy service called from Android, focusing on latency and connectivity (especially older Android).

## Architecture
- Backend: trivial echo/JSON service with minimal processing (Lambda + API Gateway HTTP API, or ECS/Fargate/EC2 app behind target group).
- Edge endpoints (two hostnames to isolate TLS):
  - `baseline.example.com`: standard TLS policy on ALB/CloudFront/NLB+ALB.
  - `pqc.example.com`: PQ-capable terminator (CloudFront PQ feature if available; otherwise EC2+s2n/oqs OpenSSL behind NLB).
- Both hostnames point to the same backend; short DNS TTL.
- Observability: CloudWatch + access logs (TLS version/cipher), custom timing from clients, synthetic load tags.

## AWS TLS/PQC options
- Baseline TLS: ACM certs on ALB/NLB/CloudFront with TLS 1.2/1.3 policy.
- PQ/hybrid TLS:
  - If CloudFront PQ is available in the account/region, enable the PQ option and attach an ACM cert.
  - If not, run an EC2 PQ terminator:
    - NLB (TCP) -> EC2 with nginx or s2n-tls built with PQ/hybrid (e.g., Kyber + classical).
    - Use ACM for the cert; classical fallback must remain available.

## Test matrix
- Android versions: API 21/23/26/29/33 (captures older TLS stacks).
- Networks: Wi-Fi, LTE; simulated high-latency/packet-loss profiles.
- Payload sizes: small (1–2 KB JSON) and medium (50–200 KB).
- Metrics: DNS time, TCP connect, TLS handshake time, TTFB, total latency, negotiated protocol/cipher, success/fail rate; optional CPU/battery.

## Steps
1) Backend: deploy echo service (Lambda+HTTP API or ECS/Fargate). Keep app latency minimal.
2) Edge:
   - Baseline endpoint with standard TLS policy and logging enabled.
   - PQ endpoint via CloudFront PQ (preferred) or NLB -> PQ-enabled EC2 terminator. Enable access logs.
3) DNS: Route 53 records `baseline.example.com` -> baseline edge; `pqc.example.com` -> PQ edge. Use short TTL.
4) Android client harness:
   - Simple UI: two buttons/flows for baseline vs PQ endpoints.
   - Use OkHttp with EventListener to record timings (DNS, connect, handshake, TTFB, total) and negotiated protocol/cipher.
   - Log retries/failures; export results (file or HTTPS upload). For older devices, consider bundling Conscrypt to widen TLS support; expect PQ failures on very old stacks.
5) Synthetic load:
   - k6/vegeta/Golang client driving both endpoints with tagged User-Agent.
   - Capture handshake vs total latency distributions and failure counts from a controlled network.
6) Observability:
   - ALB/CloudFront/NLB+nginx logs to S3 with TLS fields.
   - For EC2 terminator, include nginx/s2n logs with handshake timing if available.
   - CloudWatch metrics for latency, error rates; optional VPC Flow Logs for SYN/FIN/RST patterns.
7) Data collection:
   - Compute p50/p90/p99 for handshake and total latency per endpoint and Android version.
   - Track failure rates and cipher/protocol negotiated (or failure reason).
   - Run under varied network profiles; compare deltas.
8) Validation and safety:
   - Ensure cert chain trust for old Android (RSA 2048 + SHA-256; avoid ECDSA-only if targeting very old devices).
   - Keep classical fallback on PQ endpoint.
   - Load test within safe TPS to avoid throttling.

## Next actions
1) Check PQ-TLS availability in the AWS account/region (CloudFront PQ option).
2) Stand up the dummy origin and request ACM certs for both hostnames.
3) Build Android test harness with OkHttp EventListener and exportable logs.
4) Prepare k6 scripts for baseline vs PQ runs; enable logs/metrics.
5) Execute across Android versions with network conditioning; collect and compare results.

## Region check: Singapore (ap-southeast-1)
- CloudFront is global; PQ enablement is account-level. In the console, create/edit a distribution and look for the PQ security policy option (e.g., a PQ/hybrid TLS policy). If it appears, it will front POPs worldwide, including Singapore.
- If PQ is unavailable in the account, deploy the DIY PQ terminator in ap-southeast-1: NLB (TCP) -> EC2 with PQ-enabled nginx/s2n-tls and an ACM cert issued in ap-southeast-1.
- For non-CloudFront ALB/NLB termination, ACM certs must be in ap-southeast-1; for CloudFront, ACM cert must be in us-east-1 as usual.
