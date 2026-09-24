# TECHY Desktop Launcher
# A global overlay for the TECHY local assistant.
#
#   - Ctrl+Space shows it ABOVE whatever application you are using.
#   - It watches the Windows clipboard and classifies it (URL, email, phone,
#     code, table, address, plain) by talking to the local TECHY server.
#   - One-line questions are answered by TECHY at http://localhost:3000/api/chat.
#   - Clipboard actions call /api/clipboard/act and /api/memory.
#
# Run with:   powershell -NoProfile -Sta -ExecutionPolicy Bypass -File TechyLauncher.ps1
# Smoke test: powershell -NoProfile -Sta -ExecutionPolicy Bypass -File TechyLauncher.ps1 -SmokeTest
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads .ps1 as ANSI).

[CmdletBinding()]
param(
    [switch]$SmokeTest
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

$script:BaseUrl = $env:TECHY_URL
if (-not $script:BaseUrl) { $script:BaseUrl = 'http://localhost:3000' }
$script:BaseUrl = $script:BaseUrl.TrimEnd('/')

# ---- Palette ---------------------------------------------------------------
$script:Navy   = [System.Drawing.Color]::FromArgb(255, 7, 12, 27)
$script:Navy90 = [System.Drawing.Color]::FromArgb(230, 7, 12, 27)
$script:Panel  = [System.Drawing.Color]::FromArgb(255, 10, 18, 40)
$script:Block  = [System.Drawing.Color]::FromArgb(255, 16, 26, 55)
$script:Slate  = [System.Drawing.Color]::FromArgb(255, 148, 163, 184)
$script:SlateD = [System.Drawing.Color]::FromArgb(255, 71, 85, 105)
$script:Text   = [System.Drawing.Color]::FromArgb(255, 226, 232, 240)
$script:Cyan   = [System.Drawing.Color]::FromArgb(255, 34, 211, 238)
$script:Amber  = [System.Drawing.Color]::FromArgb(255, 251, 191, 36)
$script:Danger = [System.Drawing.Color]::FromArgb(255, 251, 113, 133)

Add-Type -TypeDefinition @"
using System;
using System.Windows.Forms;
using System.Runtime.InteropServices;

public static class TechyNative {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}

public class TechyHotKeyForm : Form {
  public Action HotKeyPressed;
  private const int WM_HOTKEY = 0x0312;
  protected override void WndProc(ref Message m) {
    if (m.Msg == WM_HOTKEY) {
      Action handler = HotKeyPressed;
      if (handler != null) handler();
    }
    base.WndProc(ref m);
  }
}
"@ -ReferencedAssemblies (
    [System.Reflection.Assembly]::GetAssembly([System.Windows.Forms.Form]).Location,
    [System.Reflection.Assembly]::GetAssembly([System.Drawing.Bitmap]).Location
)

# ---------------------------------------------------------------------------
# Control factories
# ---------------------------------------------------------------------------
function New-Label {
    param([string]$Text, [int]$X, [int]$Y, [int]$W, [int]$H, [string]$Color = 'Text', [float]$Size = 9, [bool]$Bold = $false, [string]$Mono = '')
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Left = $X; $label.Top = $Y; $label.Width = $W; $label.Height = $H
    $label.BackColor = [System.Drawing.Color]::Transparent
    $label.ForeColor = [System.Drawing.Color]::$Color
    if ($Mono) { $label.Font = New-Object System.Drawing.Font('Consolas', $Size, [System.Drawing.FontStyle]::Regular) }
    else { $label.Font = New-Object System.Drawing.Font('Segoe UI', $Size, $(if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular })) }
    return $label
}

function New-Button {
    param([string]$Text, [int]$X, [int]$Y, [int]$W, [int]$H, [string]$Kind = 'outline')
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Left = $X; $button.Top = $Y; $button.Width = $W; $button.Height = $H
    $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $button.FlatAppearance.BorderSize = 1
    $button.Cursor = [System.Windows.Forms.Cursors]::Hand
    $button.BackColor = $script:Panel
    $button.Font = New-Object System.Drawing.Font('Segoe UI', 8.5, [System.Drawing.FontStyle]::Regular)
    if ($Kind -eq 'primary') {
        $button.ForeColor = [System.Drawing.Color]::FromArgb(255, 2, 6, 23)
        $button.BackColor = $script:Cyan
        $button.FlatAppearance.BorderColor = $script:Cyan
    }
    elseif ($Kind -eq 'danger') {
        $button.ForeColor = $script:Danger
        $button.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(255, 127, 29, 29)
    }
    else {
        $button.ForeColor = $script:Cyan
        $button.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(255, 34, 211, 238, 0.55)
    }
    return $button
}

function New-StatusStrip {
    param([int]$Y, [int]$H)
    $label = New-Label -Text 'Press Ctrl+Space above any app.' -X 18 -Y $Y -W 470 -H $H -Color 'Slate' -Size 8 -Mono 'yes'
    return $label
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
$script:Http = New-Object System.Net.Http.HttpClient
$script:Http.Timeout = [System.TimeSpan]::FromSeconds(45)

# Serialises arbitrary object to JSON, using depth so hashtables work in PS 5.1.
function ConvertTo-JsonSafe {
    param($Value)
    return (ConvertTo-Json -InputObject $Value -Depth 8 -Compress)
}

# Fire-and-forget POST to the TECHY server. Invokes $OnResult(Status, BodyText)
# on the UI thread when it completes. A sequence guard drops stale responses.
$script:JobSeq = 0
$script:PendingJob = 0
$script:Cb = $null
$script:ActLabel = $null

function Post-ApiAsync {
    param([string]$Path, [string]$Body, [scriptblock]$OnResult)
    $script:JobSeq++
    $script:PendingJob = $script:JobSeq
    $script:Cb = $OnResult
    $uri = "$($script:BaseUrl)$Path"
    try {
        $content = New-Object System.Net.Http.StringContent($Body, [System.Text.Encoding]::UTF8, 'application/json')
        $task = $script:Http.PostAsync($uri, $content)
        $action = [Action[System.Threading.Tasks.Task[System.Net.Http.HttpResponseMessage]]]{
            param($t)
            try {
                $response = $t.GetAwaiter().GetResult()
                $status = [int]$response.StatusCode
                $bodyText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }
            catch {
                $status = 0
                $bodyText = ''
            }
            if ($script:PendingJob -ne $script:JobSeq) { return }
            try { $null = $script:Form.Invoke([Action]{ & $script:Cb $status $bodyText }) } catch {}
        }
        $null = $task.ContinueWith($action)
    }
    catch {
        try { $null = $script:Form.Invoke([Action]{ & $script:Cb 0 '' }) } catch {}
    }
}

# ---------------------------------------------------------------------------
# App logic
# ---------------------------------------------------------------------------
$script:LastClipFingerprint = $null
$script:LastClipText = ''

function Get-ClipboardTextSafe {
    try {
        if ([System.Windows.Forms.Clipboard]::ContainsText()) {
            return [System.Windows.Forms.Clipboard]::GetText()
        }
    }
    catch { }
    return ''
}

function Get-Fingerprint {
    param([string]$Value)
    if (-not $Value) { return $null }
    return ($Value -replace '\s+', ' ').Trim().ToLower().Substring(0, [Math]::Min(256, $Value.Length))
}

function Set-Status {
    param([string]$Text, [string]$Color = 'Slate')
    try {
        $script:StatusLabel.Text = $Text
        $script:StatusLabel.ForeColor = [System.Drawing.Color]::$Color
    }
    catch { }
}

function Set-Result {
    param([string]$Text)
    $script:ResultBox.Text = $Text
}

function Append-Result {
    param([string]$Text)
    $box = $script:ResultBox
    if ($box.Text.Length -gt 0) { $box.AppendText("`r`n`r`n") }
    $box.AppendText($Text)
}

function Add-ActionButton {
    param([string]$Label, [scriptblock]$OnClick)
    $button = New-Button -Text $Label -X 0 -Y 0 -W 0 -H 28 -Kind 'outline'
    $button.Width = [Math]::Max(92, ($Label.Length * 8) + 28)
    $button.Tag = $Label
    if ($OnClick) { $button.Add_Click($OnClick) }
    [void]$script:ActionFlow.Controls.Add($button)
}

function Clear-Actions {
    $script:ActionFlow.Controls.Clear()
}

function Update-ActionButtons {
    param($Intel)
    Clear-Actions
    if (-not $Intel -or -not $Intel.actions) { return }
    foreach ($action in $Intel.actions) {
        if ($action -eq 'save') { continue }
        Add-ActionButton -Label $action.ToString() -OnClick {
            Run-ClipboardAction $this.Tag
        }
    }
    Add-ActionButton -Label 'Save' -OnClick {
        Save-Clipboard
    }
}

function Run-ClipboardAction {
    param([string]$Action)
    if (-not $script:LastClipText) { Set-Status 'Clipboard is empty.' 'Danger'; return }
    Set-Status "Running '$Action' locally..." 'Cyan'
    $script:ActLabel = $Action
    $payload = (ConvertTo-JsonSafe @{ text = $script:LastClipText; action = $Action })
    Post-ApiAsync -Path '/api/clipboard/act' -Body $payload -OnResult {
        param($Status, $Raw)
        if ($Status -ne 200 -or -not $Raw) { Set-Status "TECHY not reachable ($Status)." 'Danger'; return }
        try { $data = $Raw | ConvertFrom-Json } catch { Set-Status 'Bad response.' 'Danger'; return }
        $label = $script:ActLabel
        if ($data.reply) {
            Set-Result "[$label]`r`n$($data.reply)"
            Set-Status "Done - '$label' (offline: $($data.offline))." 'Amber'
        }
        else {
            Set-Status "Action '$label' needs a local AI model (Ollama on 11434)." 'Danger'
            Set-Result "[$label]`r`nConnect a local model to full power, or ask TECHY in the browser."
        }
    }
}

function Save-Clipboard {
    if (-not $script:LastClipText) { Set-Status 'Clipboard is empty.' 'Danger'; return }
    $clipLen = [Math]::Min(1200, $script:LastClipText.Length)
    $payload = (ConvertTo-JsonSafe @{ content = $script:LastClipText.Substring(0, $clipLen); source = 'launcher' })
    Post-ApiAsync -Path '/api/memory' -Body $payload -OnResult {
        param($Status, $Raw)
        if ($Status -eq 201 -or $Status -eq 200) { Set-Status 'Saved to TECHY memory.' 'Amber' }
        else { Set-Status "Save failed ($Status)." 'Danger' }
    }
}

function Submit-Question {
    param([string]$Question)
    if (-not $Question) { return }
    Set-Result ''
    Set-Status "$($script:BrandName) is answering..." 'Cyan'
    $payload = (ConvertTo-JsonSafe @{ messages = @(@{ role = 'user'; content = $Question }) })
    Post-ApiAsync -Path '/api/chat' -Body $payload -OnResult {
        param($Status, $Raw)
        if ($Status -ne 200 -or -not $Raw) { Set-Status "TECHY not reachable ($Status) - is the server running?" 'Danger'; return }
        try { $data = $Raw | ConvertFrom-Json } catch { Set-Status 'Bad response.' 'Danger'; return }
        if ($data.available -and $data.reply) {
            Set-Result $data.reply
            Set-Status 'Answered by the local model.' 'Cyan'
        }
        else {
            Set-Result 'No local AI model is connected right now (Ollama at localhost:11434).'
            Set-Status 'Offline' 'Amber'
        }
    }
}

function Toggle-Visibility {
    if ($script:Form.Visible) {
        $script:Form.Hide()
    }
    else {
        $script:Form.Show()
        $script:Form.Activate()
        $script:Form.TopMost = $true
        $script:QueryBox.Focus()
        if (-not $script:ResultBox.Text) {
            Check-Clipboard
        }
    }
}

function Check-Clipboard {
    $text = Get-ClipboardTextSafe
    $fingerprint = Get-Fingerprint $text
    if ((-not $fingerprint) -or ($fingerprint -eq $script:LastClipFingerprint)) { return }
    $script:LastClipFingerprint = $fingerprint
    $script:LastClipText = $text

    $payload = (ConvertTo-JsonSafe @{ text = $text })
    Post-ApiAsync -Path '/api/clipboard/intel' -Body $payload -OnResult {
        param($Status, $Raw)
        if ($Status -ne 200 -or -not $Raw) { return }
        try { $intel = $Raw | ConvertFrom-Json } catch { return }
        $script:LastIntel = $intel
        $script:LastClipText = $intel.sample
        Update-ActionButtons $intel
        Set-Status "CLIPBOARD DETECTED - $($intel.label) . $($intel.charCount) chars" 'Cyan'
        Set-Result "CLIPBOARD DETECTED - $($intel.label)`r`n----------------------------`r`n$($intel.preview)"
    }
}

# ---------------------------------------------------------------------------
# UI construction
# ---------------------------------------------------------------------------
function Build-Ui {
    $script:Form = New-Object TechyHotKeyForm
    $form = $script:Form
    $form.Text = 'TECHY Launcher'
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.BackColor = $script:Navy
    $form.Width = 680
    $form.Height = 520
    $form.TopMost = $true
    $form.ShowInTaskbar = $true
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.KeyPreview = $true

    $work = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $form.Left = $work.Left + [int](($work.Width - $form.Width) / 2)
    $form.Top = $work.Top + [int]($work.Height * 0.08)

    # Header
    $header = New-Object System.Windows.Forms.Panel
    $header.BackColor = $script:Panel
    $header.Dock = [System.Windows.Forms.DockStyle]::Top
    $header.Height = 52
    $form.Controls.Add($header)

    $title = New-Label -Text "** $($script:BrandName)" -X 18 -Y 14 -W 260 -H 22 -Color 'Text' -Size 12 -Bold $true
    $header.Controls.Add($title)

    $subtitle = New-Label -Text 'Local AI . clipboard aware' -X 18 -Y 35 -W 260 -H 14 -Color 'SlateD' -Size 7.5 -Mono 'yes'
    $header.Controls.Add($subtitle)

    $close = New-Object System.Windows.Forms.Button
    $close.Text = 'X'
    $close.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $close.FlatAppearance.BorderSize = 0
    $close.BackColor = $script:Panel
    $close.ForeColor = $script:SlateD
    $close.Width = 34; $close.Height = 30
    $close.Left = $form.Width - 46; $close.Top = 11
    $close.Add_Click({ $script:Form.Hide() })
    $header.Controls.Add($close)

    # Query
    $script:QueryBox = New-Object System.Windows.Forms.TextBox
    $qb = $script:QueryBox
    $qb.Multiline = $false
    $qb.Font = New-Object System.Drawing.Font('Segoe UI', 11)
    $qb.BackColor = $script:Block
    $qb.ForeColor = $script:Text
    $qb.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $qb.Left = 18; $qb.Top = 66; $qb.Width = $form.Width - 36; $qb.Height = 38
    $qb.Add_KeyDown({
        param($sender, $args)
        if ($args.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
            $args.SuppressKeyPress = $true
            Submit-Question $script:QueryBox.Text
        }
        elseif ($args.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
            $script:Form.Hide()
        }
    })
    $form.Controls.Add($qb)

    # Status
    $script:StatusLabel = New-StatusStrip -Y 112 -H 16
    $form.Controls.Add($script:StatusLabel)

    # Result
    $script:ResultBox = New-Object System.Windows.Forms.TextBox
    $rb = $script:ResultBox
    $rb.Multiline = $true
    $rb.ReadOnly = $true
    $rb.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
    $rb.Font = New-Object System.Drawing.Font('Consolas', 9.5)
    $rb.BackColor = $script:Navy90
    $rb.ForeColor = $script:Text
    $rb.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $rb.Left = 18; $rb.Top = 132; $rb.Width = $form.Width - 36; $rb.Height = 292
    $form.Controls.Add($rb)

    # Actions
    $script:ActionFlow = New-Object System.Windows.Forms.FlowLayoutPanel
    $af = $script:ActionFlow
    $af.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
    $af.WrapContents = $true
    $af.Padding = New-Object System.Windows.Forms.Padding(16, 0, 16, 0)
    $af.BackColor = $script:Navy
    $af.Left = 0; $af.Top = 432; $af.Width = $form.Width; $af.Height = 36
    $form.Controls.Add($af)

    # Footer
    $footer = New-Label -Text "Ctrl+Space above any app . Esc to hide . $($script:BaseUrl)" -X 18 -Y 474 -W 640 -H 16 -Color 'SlateD' -Size 7.5 -Mono 'yes'
    $form.Controls.Add($footer)

    # Clipboard watcher
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 600
    $timer.Add_Tick({ Check-Clipboard })
    $timer.Start()

    $form.Add_Shown({ $script:QueryBox.Focus() })
    $form.Add_FormClosed({ $timer.Stop() })

    # Global hotkey
    $script:HotKeyHandler = [Action]{ Toggle-Visibility }
    $form.HotKeyPressed = $script:HotKeyHandler
    $null = $form.Handle
    $MOD_CONTROL = 0x0002
    $VK_SPACE = 0x20
    [void][TechyNative]::RegisterHotKey($form.Handle, 9001, $MOD_CONTROL, $VK_SPACE)
    $form.Add_FormClosed({
        [TechyNative]::UnregisterHotKey($form.Handle, 9001) | Out-Null
    })
}

# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------
function Test-Smoke {
    Write-Output "TECHY Launcher smoke test - server: $($script:BaseUrl)"
    $sample = 'Client proposal: Techy AI launches next week. The new command palette ships 10 capability layers and the desktop launcher overlays every app. It runs fully offline.'
    $intelBody = (ConvertTo-JsonSafe @{ text = $sample })
    try {
        $response = Invoke-RestMethod -Uri "$($script:BaseUrl)/api/clipboard/intel" -Method Post -Body $intelBody -ContentType 'application/json' -TimeoutSec 15
        Write-Output "intel: kind=$($response.kind) actions=$($response.actions -join ',')"
    }
    catch {
        Write-Output "FAILED intel: $($_.Exception.Message)"
        exit 1
    }
    $actBody = (ConvertTo-JsonSafe @{ text = $sample; action = 'summarize' })
    try {
        $result = Invoke-RestMethod -Uri "$($script:BaseUrl)/api/clipboard/act" -Method Post -Body $actBody -ContentType 'application/json' -TimeoutSec 15
        Write-Output "act(summarize): offline=$($result.offline) reply=$($result.reply)"
    }
    catch {
        Write-Output "FAILED act: $($_.Exception.Message)"
        exit 1
    }
    Write-Output 'Smoke test OK.'
}

# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------
[void][System.Windows.Forms.Application]::EnableVisualStyles()
[void][System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($true)

$script:BrandName = 'TECHY'
$script:LastIntel = $null

if ($SmokeTest) {
    Test-Smoke
    exit 0
}

Build-Ui
[void][System.Windows.Forms.Application]::Run($script:Form)