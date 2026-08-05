# Windows: cloudflared service-install & verification runbook

Run PowerShell as Administrator and follow these steps exactly. Do not change staging Worker URL until the tunnel and Access service token are verified.

## 1. Verify local prerequisites

```powershell
Set-Location F:\TorqueMind

ollama list

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

Do not proceed until Ollama responds locally with the expected content.

## 2. Check whether `cloudflared` is already installed

```powershell
$Cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue

if ($Cloudflared) {
    cloudflared --version
    $Cloudflared.Source
} else {
    Write-Host "cloudflared is not installed or not in PATH."
}

Get-Service cloudflared -ErrorAction SilentlyContinue | Format-List Name,Status,StartType
```

If `cloudflared` is not present, install from Cloudflare's official downloads and add it to `PATH`.

## 3. Create the remotely managed tunnel (Cloudflare dashboard)

1. Open **Networking → Tunnels** in the Cloudflare dashboard.
2. Click **Create a tunnel** → choose **Cloudflared**.
3. Name it `torquemind-ollama`.
4. Select **Windows** as the connector platform.
5. Copy the exact installation command provided by the dashboard. It will look like:

```powershell
cloudflared.exe service install <TUNNEL_TOKEN>
```

6. Run the provided command from an elevated PowerShell prompt.

> Security: the `TUNNEL_TOKEN` is sensitive. Do not paste it into chat, commit it, or store it in project files.

If a `cloudflared` service already exists on the machine, add the route to the existing tunnel rather than installing a second service.

## 4. Verify the Windows service

```powershell
Get-Service cloudflared | Format-List Name,DisplayName,Status,StartType

sc.exe query cloudflared
```

Expected output:

```
Status    : Running
StartType : Automatic
```

If the service is installed but stopped:

```powershell
Start-Service cloudflared
Set-Service cloudflared -StartupType Automatic
```

Check recent service events for cloudflared:

```powershell
Get-WinEvent -LogName Application -MaxEvents 100 |
    Where-Object {
        $_.ProviderName -match "cloudflared" -or
        $_.Message -match "cloudflared|Cloudflare Tunnel"
    } |
    Select-Object -First 20 TimeCreated,LevelDisplayName,Message |
    Format-List
```

## 5. Confirm tunnel connectivity

- In the Cloudflare dashboard the tunnel should report **Healthy**.
- Optionally run:

```powershell
cloudflared tunnel list
```

## 6. Add the Ollama published route (dashboard)

Inside the `torquemind-ollama` tunnel, add a public hostname route:

- Subdomain: `ollama`
- Domain: your Cloudflare-managed domain
- Path: blank
- Type: `HTTP`
- URL: `127.0.0.1:11434`

Result:

```
https://ollama.yourdomain.com
    →
http://127.0.0.1:11434
```

Do not configure the origin as HTTPS unless Ollama itself serves HTTPS.

## 7. Brief connectivity test (before Access protection)

Only a brief check to confirm connectivity. Immediately add Access protection after this test.

```powershell
$TunnelHost = "https://ollama.yourdomain.com"

Invoke-WebRequest `
    -Uri "$TunnelHost/api/tags" `
    -Method GET `
    -UseBasicParsing
```

Expected: HTTP 200 and a model list response. Do not leave the endpoint publicly reachable — proceed to Cloudflare Access protection immediately.

## 8. Create Cloudflare Access protection (dashboard)

1. In Cloudflare Zero Trust, go to **Access controls → Applications**.
2. Create a **Self-hosted** application using `ollama.yourdomain.com`.
3. Create a policy:

- Action: **Service Auth**
- Include: **Service Token**

4. Do not create a bypass or public allow rule.

5. Create a Service Token under **Access controls → Service credentials → Service Tokens** named `torquemind-worker-to-ollama` and copy the `Client ID` and `Client Secret` (save securely).

## 9. Directly verify Access-protected Ollama (PowerShell)

```powershell
$TunnelHost = "https://ollama.yourdomain.com"

$ClientId = Read-Host "Access Client ID"
$SecureSecret = Read-Host "Access Client Secret" -AsSecureString
$ClientSecret = [System.Net.NetworkCredential]::new("", $SecureSecret).Password

$Headers = @{
    "CF-Access-Client-Id"     = $ClientId
    "CF-Access-Client-Secret" = $ClientSecret
}

$Tags = Invoke-WebRequest `
    -Uri "$TunnelHost/api/tags" `
    -Headers $Headers `
    -Method GET `
    -UseBasicParsing

[PSCustomObject]@{
    Status = $Tags.StatusCode
    Body   = $Tags.Content
}

# Chat test
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
    -UseBasicParsing

[PSCustomObject]@{
    Status = $Chat.StatusCode
    Body   = $Chat.Content
}

# Clear temp variables
$ClientId = $null
$ClientSecret = $null
$SecureSecret = $null
$Headers = $null
```

Expected: both `/api/tags` and `/api/chat` return HTTP 200.

## 10. After successful verification

- Proceed to add `OLLAMA_ACCESS_CLIENT_ID` and `OLLAMA_ACCESS_CLIENT_SECRET` as staging Worker secrets via `wrangler` or the dashboard.
- Update staging metadata and deploy per the staging checklist.

---

Commit this runbook as documentation (do not include tokens). RALA chunk work remains separate.
