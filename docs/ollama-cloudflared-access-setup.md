# Ollama Cloudflared & Cloudflare Access setup (exact steps)

Follow these steps in order. Do not change the staging Worker URL until the tunnel and Access service token are verified.

1. Verify Ollama locally

```
ollama list
```

Then test the local API (PowerShell example):

```
$Body = @{
    model = "gpt-oss:20b"
    messages = @(
        @{
            role    = "user"
            content = 'Reply only with {"status":"ok"}'
        }
    )
    stream = $false
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
    -Uri "http://127.0.0.1:11434/api/chat" `
    -Method POST `
    -ContentType "application/json" `
    -Body $Body
```

Do not continue until this succeeds locally.

2. Install or verify `cloudflared`

```
cloudflared --version
```

If unavailable, install it using Cloudflare's download instructions. Cloudflare recommends running the connector as a service so it starts at boot and remains available while the origin machine is online.

3. Recommended approach: remotely managed tunnel

In Cloudflare:

1. Open **Networking → Tunnels**.
2. Create a new tunnel named:

```
torquemind-ollama
```

3. Select Windows as the connector platform.
4. Copy the generated service-install command and run it as Administrator:

```
cloudflared.exe service install <TUNNEL_TOKEN>
```

If a cloudflared service already exists on the machine, add the new route to the existing tunnel rather than installing another service.

Verify the service:

```
Get-Service cloudflared
```

Expected `Status : Running`.

4. Add the published application route

Map the public hostname to the local Ollama port. Example:

```
ollama.example.com
    →
http://127.0.0.1:11434
```

Do not set the origin to HTTPS unless Ollama itself serves HTTPS.

5. Create the Access application

In Cloudflare Zero Trust:

1. Go to **Access controls → Applications**.
2. Create a **Self-hosted** application using the hostname `ollama.<your-domain>`.
3. Create a policy with:

```
Action: Service Auth
Include: Service Token
```

Do not add a public bypass policy.

6. Create the service token

In Cloudflare Zero Trust:

1. Go to **Access controls → Service credentials → Service Tokens**.
2. Create a token named:

```
torquemind-worker-to-ollama
```

Cloudflare will show `Client ID` and `Client Secret`. Save both immediately.

7. Test the protected tunnel outside the Worker (PowerShell example)

Store values temporarily using secure prompts:

```
$ClientId = Read-Host "Cloudflare Access Client ID"
$SecureClientSecret = Read-Host "Cloudflare Access Client Secret" -AsSecureString
$ClientSecret = [System.Net.NetworkCredential]::new(
    "",
    $SecureClientSecret
).Password
```

Test `/api/tags` first:

```
$Headers = @{
    "CF-Access-Client-Id"     = $ClientId
    "CF-Access-Client-Secret" = $ClientSecret
}

$TunnelHost = "https://ollama.<your-domain>"

$Tags = Invoke-WebRequest `
    -Uri "$TunnelHost/api/tags" `
    -Headers $Headers `
    -Method GET `
    -SkipHttpErrorCheck

[PSCustomObject]@{
    Status = $Tags.StatusCode
    Body   = $Tags.Content
}
```

Expected: `Status = 200`.

Then test `/api/chat`:

```
$ChatBody = @{
    model = "gpt-oss:20b"
    messages = @(
        @{
            role    = "user"
            content = 'Reply only with {"status":"ok"}'
        }
    )
    stream = $false
} | ConvertTo-Json -Depth 10

$Chat = Invoke-WebRequest `
    -Uri "$TunnelHost/api/chat" `
    -Headers $Headers `
    -Method POST `
    -ContentType "application/json" `
    -Body $ChatBody `
    -SkipHttpErrorCheck

[PSCustomObject]@{
    Status = $Chat.StatusCode
    Body   = $Chat.Content
}
```

Expected: `Status = 200`.

Clear temporary variables:

```
$ClientId = $null
$ClientSecret = $null
$SecureClientSecret = $null
$Headers = $null
```

8. Add the Worker secrets (only after the direct tunnel test succeeds)

```
npx wrangler secret put OLLAMA_ACCESS_CLIENT_ID --env staging
npx wrangler secret put OLLAMA_ACCESS_CLIENT_SECRET --env staging

npx wrangler secret list --env staging
```

Expected names: `OLLAMA_ACCESS_CLIENT_ID`, `OLLAMA_ACCESS_CLIENT_SECRET`.

9. Update staging metadata (only after hostname is active and protected)

```
"TORQUEMIND_AI_PROVIDER": "ollama",
"TORQUEMIND_AI_URL": "https://ollama.<your-domain>/api/chat",
"TORQUEMIND_AI_MODEL": "gpt-oss:20b",
"TORQUEMIND_AI_TIMEOUT_MS": "120000"
```

10. Deploy and test

```
npm run build

npx wrangler deploy --env staging

git restore -- public/version.json
git status --short

npx wrangler tail car-diagnosis-simulator-staging --format pretty
```

Verification expectations:

- The staging tutor request must return HTTP `200` with JSON including `reasonIncorrect`, `reasonCorrect`, `aseConcept`, and `nextStep`.
- Preserve headers: `x-request-id`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`.
- Do not merge PR #332 until this succeeds.

11. Rollback and audit

- If verification fails, revert staging to the previous artifact and configuration. Document the artifact ID and redeploy.
- Confirm logs contain no prompts, answers, secrets, raw IPs, or Access headers.

Notes

- Keep local and task-specific Ollama models unchanged; these rules apply only to the Worker staging/production path.
- RALA chunk completion remains a separate workstream.
