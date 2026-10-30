# Private Local AI Gateway

## Status and Boundary

The Ollama adapter and shared capacity gateway are implemented and tested
locally. These files do not install a service, create a tunnel, change SSH or
firewall configuration, switch production providers, or deploy the application.
Remote activation requires a separate, explicit approval.

On 2026-10-30 an explicitly approved private instance was activated: Node
22.22.1 on the home host, the gateway and dedicated SSH tunnel enabled in
systemd, and the VPS listener restricted to loopback. Synthetic VPS-to-model
acceptance passed, including shared queue/cancel and service/tunnel recovery.
Production Web/Express deployment and Gemini selection were not changed.
Whole-host reboot and deliberate GPU OOM tests were not performed.

The existing Gemini integration remains the default. There is no local-to-cloud
fallback. Failure of local inference never causes a diary to be sent to Gemini.
The gateway is not an Agent orchestrator and never executes returned tools.

## Transport Decision

| Option | Security and recovery | Cost/complexity | Current fit |
| --- | --- | --- | --- |
| SSH reverse tunnel | Home initiates an authenticated, encrypted connection; explicit VPS loopback binding; pinned host key; service-managed reconnect | No new VPN control plane; two small service units, key rotation and health checks | Recommended initial two-host transport; existing SSH management path already works |
| WireGuard | Narrow peer routes/allowed IPs and port restrictions; persistent keepalive through NAT | Additional interface, keys, UDP/firewall/routing approval | Suitable longer-term private network, not required for this stage |
| Tailscale | Identity-based grants to one service port; NAT handling; relay path can affect latency | Tailnet policy, identity/key lifecycle and plan eligibility | Viable if the existing installation is approved and configured; not assumed connected |

No measured latency comparison of the three transports has been performed.
Reachable SSH management is not proof of a reachable inference API. WireGuard
or Tailscale also cannot access a loopback-only Ollama socket without an
approved gateway/forwarder. Do not expose `11434` on `0.0.0.0` or add a public
Nginx location for it.

Proposed topology:

```text
Browser -> existing HTTPS/JWT Express API
  -> http://127.0.0.1:11435 (VPS; server credential only)
  -> dedicated SSH reverse forwarding over encrypted SSH
  -> http://127.0.0.1:11435 (home shared gateway)
  -> http://127.0.0.1:11434 (Ollama)
```

Both gateway listeners and the Ollama listener are loopback-only. HTTP is only
used on the two hosts' loopback legs; the inter-host leg uses SSH encryption.
Existing SSH administration and port `22022` are not reused or modified.

## Adapter and Request Contract

`services/ollama.js` exposes `createOllamaProvider` with `generate`, `chat`,
`healthCheck` and `cancel`. The same bounded result shape supports direct
Ollama access inside the home gateway and authenticated gateway access from
Express. No browser imports this module or receives the server credential.

- Fixed model allowlist: `qwen3.5:4b-q4_K_M`. No model pull/create/delete endpoint.
- Literal loopback IP URLs only; no credentials, arbitrary paths, query URLs,
  DNS-based targets or redirects. Remote addresses cannot come from model data.
- Native Node fetch/AbortController; no Ollama SDK dependency.
- Default `num_ctx: 4096`, explicit 8192 only with `OLLAMA_ALLOW_8K=1`.
- Default output 512 tokens; hard maximum 1,024. `stream: false`, `think: false`.
- Maximum eight messages and four declared tools; tool responses are validated,
  returned as data, and never executed. Full tool-result conversation plumbing
  is intentionally deferred to Agent Tools.
- Ajv validates structured JSON and declared tool argument schemas. Unknown
  tool names, malformed JSON, invalid types and truncated responses fail closed.
- Schemas are bounded to 5,000 characters/eight levels and common type, property,
  array, enum, length and numeric constraints. References, regex patterns,
  asynchronous schemas and unsupported keywords are rejected before compilation;
  project credentials do not grant arbitrary schema-computation privileges.
- Input uses a conservative UTF-8-byte allowance plus a 1,024-token template
  reserve and output reserve. It is not an exact tokenizer. Overlarge existing
  diary contexts receive `context_limit`; they are not silently truncated or
  forwarded to a cloud provider. Phase 3 needs token-aware context planning.
- Complete response body limit: 128 KiB. Gateway request body: 48 KiB; inference
  input has the much smaller context-based bound above.
- Results include text/validated JSON/tool calls plus prompt/output token counts,
  load duration and generation duration. Thinking text is not forwarded.

`aiProvider.js` selects the existing Gemini generator unless `AI_PROVIDER=ollama`.
Local generation also requires `OLLAMA_GATEWAY_VERIFIED=1`. Both switches stay
off in examples. Unknown provider names are configuration errors, not fallbacks.
The existing `/ai/life-map` and `/ai/chat` route shapes stay intact.

## Shared GPU Capacity

Run exactly one `local-ai/server.js` instance on the GPU host. Do not launch one
gateway per VPS worker/project, or each would create an independent queue.

The shared scheduler has:

- One active generation globally.
- Two waiting jobs globally, FIFO.
- At most two outstanding jobs per project, leaving room for the other project.
- At most one outstanding job per subject within a project.
- A 15-second maximum queue wait and a 40-second overall task deadline including
  queue time. The HTTP adapter caps its complete call at 43 seconds.
- Distinct project credentials; the credential determines the project, not a
  client-supplied project name. Subject values are HMACs of authenticated user IDs,
  never JWTs or raw diary/user data. Cancellation checks both project and subject.
- No automatic replay of a failed generation. Health-only availability checks
  have at most one 100ms-backoff retry within an overall 4.5-second deadline.
- A circuit opens after three availability/invalid-response failures or an OOM.
  Its cooldown is 30 seconds; a single generation probe is allowed afterwards.

These are gateway guarantees for traffic passing through this one process,
not a claim that another local application cannot bypass it. Before activation,
Ollama must also be configured and restarted with `OLLAMA_NUM_PARALLEL=1`,
`OLLAMA_MAX_LOADED_MODELS=1`, and a small `OLLAMA_MAX_QUEUE`. Every project sharing
the GPU must use the gateway. NAVI is not modified here; any existing direct
Ollama integration remains outside gateway admission until separately migrated.

### Cancellation and Uncertain Work

Cancelling queued work removes it without calling Ollama. An active caller's
HTTP wait ends immediately, but the gateway deliberately drains that bounded
generation before releasing the GPU slot. HTTP abort is not proof that GPU
execution stopped. A cancelled result is discarded.

On a hard deadline, the gateway aborts the upstream HTTP request and enters
`recovery_required` if remote execution may still be active. Connection-refused
before dispatch can use normal circuit recovery; uncertain disconnects cannot.
Ordinary health checks do not clear this quarantine, even if `/api/ps` is empty:
that endpoint does not prove there is no queued/loading work.

For confirmed uncertain-work recovery, drain all projects, stop the gateway,
confirm/restart Ollama under the approved single-generation configuration,
check the GPU and running models, then restart the gateway. No queued job or
private content is persisted or automatically replayed. A gateway-only restart
does not, by itself, prove an earlier Ollama generation has stopped.

This fail-closed policy trades availability for a correct single-GPU limit.
Actual process-restart/GPU cancellation behavior remains a remote acceptance
item, not something established by Mock tests.

## Health, Diagnostics and Logging

Authenticated home `/health` checks `/api/version`, `/api/show` and `/api/ps`.
It distinguishes an available cold model from a loaded model and reports
context allocation, model VRAM, circuit state, active/waiting counts, timeouts
and last request duration. It never warms or downloads a model.

Express `GET /ai/provider-status` requires the existing JWT and admin/owner
authorization, is no-store and rate-limited. An administrator may request
`?provider=ollama` before switching generation providers. Default Gemini status
reports configuration only, without a billed generation request. Returned fields
are selected explicitly; tokens, upstream addresses and raw error bodies are not
included. No public health route adds internal topology.

A failed connection from Express means the private gateway endpoint is
unreachable; it cannot uniquely distinguish a broken tunnel from a stopped
gateway. When the gateway responds but Ollama does not, health marks the
upstream unavailable. Service-manager logs/listener checks are needed to
diagnose the SSH leg independently.

Log allowlist: generated request ID, feature, project name, model, category,
duration, prompt/output counts and safe status. Never log request bodies,
private diary text, tool arguments, model reasoning, JWTs or credentials.

## Approved Activation Procedure

Templates are in `deploy/ollama/`; none is automatically installed by the app.
The following procedure was separately approved for the private instance.

1. Home: install a supported Node runtime (this code was tested with Node 26.8.2
   locally, 22.22.1 on the home host and 20.20.2 in the VPS acceptance directory).
   Install locked API production dependencies in `/opt/adrift-gateway`.
2. Home: create separate non-root service identities `adrift-ai` and
   `adrift-ai-tunnel`; use a new dedicated SSH key, not the management key.
3. Home: review/apply `ollama-capacity.conf.example` as a new, backed-up override.
   Restarting Ollama interrupts all current local AI work, including any NAVI
   request, so this requires an approved maintenance window.
4. Home: create `/etc/adrift-ai/gateway.env` with unique random project tokens.
   Use systemd EnvironmentFile, root ownership and mode 600. Example credentials
   must never be used; the service rejects placeholder/weak tokens. Set
   `OLLAMA_SHARED_CAPACITY_READY=1` only after checking effective configuration.
5. Home: install `adrift-ai-gateway.service` and verify it listens only on
   `127.0.0.1:11435`; verify unauthenticated requests and management APIs fail.
6. VPS: create non-root `adrift-ai-tunnel`, with no interactive sessions. Install
   only the new key's public half using these additional authorized_keys options:
   `restrict,port-forwarding,permitlisten="127.0.0.1:11435"`. Key file 600, `.ssh`
   directory 700, correct ownership. No existing authorized key is removed.
7. VPS: review `sshd-match.conf.example`; confirm effective per-user settings
   with `sshd -T -C ...`, validate with `sshd -t`, then reload SSH while keeping
   an existing administrative session open. `GatewayPorts` must stay `no`, not
   `yes`; `PermitListen` permits only the specific loopback port. Local forwarding,
   shell/session channels, agent/X11 forwarding and password login are disabled
   for the dedicated tunnel user. Existing users/admin SSH remain unchanged.
8. Home: pin the independently verified VPS host fingerprint in
   `/etc/adrift-ai/known_hosts`. Private key readable only by the tunnel account,
   mode 600; the parent directory must still be traversable by that account
   (for example root:`adrift-ai-tunnel`, 750). Keep `gateway.env` root-owned 600;
   systemd reads it before changing service identity. Never use
   `StrictHostKeyChecking=no`.
   Replace the VPS hostname placeholder before installing the tunnel service.
9. Home: install/start `adrift-ai-tunnel.service`. It uses `ssh -NT`, explicit
   `-R 127.0.0.1:11435:127.0.0.1:11435`, ExitOnForwardFailure and 15s/3 keepalives.
   Systemd retries every five seconds. Do not add a firewall rule or router port.
10. VPS: verify `ss -lntp` shows the forwarded port only on `127.0.0.1`, verify
    private authenticated health and synthetic generation from the VPS, disconnect
    and recover the dedicated tunnel, then validate approved reboot/restart cases.
11. Only after approval, deploy the compatible Express code with
    `AI_PROVIDER=gemini` and `OLLAMA_GATEWAY_VERIFIED=0`. Do not switch production
    generation as part of installing transport. An eventual local switch also
    needs the UI's provider/privacy disclosure and a token-budget review.

Risks: wrong SSH Match/key permissions may break the new tunnel; wrong binding
may expose an API; Ollama restarts interrupt AI work; shared scheduler limits
may delay another project; power/network outages reduce local availability.
Existing dependency audit findings must be reviewed before production gateway
deployment; this phase does not silently run a broad `npm audit fix`.

Rollback: keep Express on Gemini, stop/disable only the new tunnel and gateway
units, remove only the newly added dedicated Match/key/account configuration,
restore the prior Ollama override and restart it in the same approved window.
Validate `sshd -t` before reloading SSH. Keep existing port-22022 management,
firewall rules, backend endpoints and MongoDB untouched. Never remove an
existing override or key without restoring its saved original.

## Test Layers

`ollama.test.js`: transport/protocol/schema/tool/budget/timeout/abort/feature-flag
tests with mocked fetch. `ai-capacity.test.js`: deterministic shared-queue,
drain, breaker and quarantine cases. `local-ai-gateway.test.js`: real loopback
HTTP between adapter, gateway and a synthetic Ollama HTTP server, including
service stop/restart and cross-project traffic. `local-ai-api.test.js`: existing
API isolation, protected diagnostics and safe local-failure behavior.

These are not SSH, real GPU concurrency or remote systemd restart tests.

`deploy/ollama/smoke.py` can be run over an authorized SSH session's stdin on
the inference host. It refuses a busy GPU/other loaded model, uses four bounded
synthetic prompts, samples `nvidia-smi` and checks actual `/api/ps` context
allocation. It does not write files, install dependencies, execute tools,
restart services or read application diaries. It verifies basic 4K/8K allocation,
not full-window retrieval quality, sustained throughput or OOM immunity.

`deploy/ollama/verify-gateway.mjs` runs in an isolated VPS acceptance directory,
not the production application. It reads a root-only project credential file,
verifies actual adapter/selector/Express-to-model requests, and optionally
checks two-project capacity with `--capacity`. `--health-only` supports
controlled outage/recovery checks without generating content. No credential
value or private diary is printed. The capacity-probe project is an operations
fixture, not a modification or live integration of NAVI.

## References

- [Ollama chat API](https://docs.ollama.com/api/chat)
- [Ollama structured output](https://docs.ollama.com/capabilities/structured-outputs)
- [Ollama tools](https://docs.ollama.com/capabilities/tool-calling)
- [Ollama running-model metrics](https://docs.ollama.com/api/ps)
- [Ollama context and concurrency settings](https://docs.ollama.com/faq)
- [OpenSSH forwarding restrictions](https://man.openbsd.org/sshd_config)
- [WireGuard NAT keepalive](https://www.wireguard.com/quickstart/)
- [Tailscale grants](https://tailscale.com/docs/features/access-control/grants)
