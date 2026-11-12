import { writeFileSync } from 'node:fs';
const ps1 = String.raw`param(
  [string]$OutDir = "H:\ccwork\MBTI-PRO\content-marketing\review-html\voice-audition-system-2026-07-02",
  [string]$BgmPath = "H:\ccwork\MBTI-PRO\video\BGM.mp3"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Speech
$text = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('RU5GUD 突然安静的时候，往往比他吵吵闹闹更让人心疼。快乐的人也会累，他只是太怕自己的低落，会把别人的兴致也拖下去。'))
`;
// Replace placeholder with real base64 without embedding non-ascii in the ps1 body.
const sample = 'ENFP突然安静的时候，往往比他吵吵闹闹更让人心疼。快乐的人也会累，他只是太怕自己的低落，会把别人的兴致也拖下去。';
const sampleB64 = Buffer.from(sample, 'utf8').toString('base64');
const finalPs1 = String.raw`param(
  [string]$OutDir = "H:\ccwork\MBTI-PRO\content-marketing\review-html\voice-audition-system-2026-07-02",
  [string]$BgmPath = "H:\ccwork\MBTI-PRO\video\BGM.mp3"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Speech
$text = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${sampleB64}'))
$ffmpeg = 'H:\ccwork\MBTI-PRO\scripts\video-pipeline\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe'
if (!(Test-Path -LiteralPath $ffmpeg)) { $ffmpeg = 'ffmpeg' }
$voices = @(
  @{ Id='sapi_huihui_rate0'; Name='Microsoft Huihui Desktop'; Label='Windows Huihui normal'; Rate=0; Volume=100; Desc='Windows SAPI Chinese female voice, system built-in, not Edge online voice' },
  @{ Id='sapi_huihui_rate2'; Name='Microsoft Huihui Desktop'; Label='Windows Huihui faster'; Rate=2; Volume=100; Desc='Windows SAPI Chinese female voice, faster short-video pacing' },
  @{ Id='sapi_huihui_rate3'; Name='Microsoft Huihui Desktop'; Label='Windows Huihui fast'; Rate=3; Volume=100; Desc='Windows SAPI Chinese female voice, fast narration version' },
  @{ Id='sapi_huihui_rate-1'; Name='Microsoft Huihui Desktop'; Label='Windows Huihui slower'; Rate=-1; Volume=100; Desc='Windows SAPI Chinese female voice, slower and steadier' }
)
$cards = New-Object System.Collections.Generic.List[string]
foreach ($voice in $voices) {
  $wav = Join-Path $OutDir ($voice.Id + '_raw.wav')
  $mp3 = Join-Path $OutDir ($voice.Id + '_raw.mp3')
  $mix = Join-Path $OutDir ($voice.Id + '_bgm.mp3')
  if (!(Test-Path -LiteralPath $wav)) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoice($voice.Name)
    $synth.Rate = [int]$voice.Rate
    $synth.Volume = [int]$voice.Volume
    $synth.SetOutputToWaveFile($wav)
    $synth.Speak($text)
    $synth.Dispose()
  }
  if (!(Test-Path -LiteralPath $mp3)) {
    & $ffmpeg -y -hide_banner -loglevel error -i $wav -c:a libmp3lame -b:a 192k $mp3
  }
  if (!(Test-Path -LiteralPath $mix)) {
    & $ffmpeg -y -hide_banner -loglevel error -i $mp3 -stream_loop -1 -i $BgmPath -filter_complex '[0:a]volume=1.35,aresample=44100[voice];[1:a]volume=0.13,atrim=0:18,asetpts=N/SR/TB,afade=t=out:st=16:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]' -map '[a]' -c:a libmp3lame -b:a 192k $mix
  }
  $cards.Add("<article class='card'><h2>$($voice.Label)<small> system</small></h2><p>$($voice.Desc)</p><div class='audio-row'><span>raw</span><audio controls src='$($voice.Id)_raw.mp3'></audio></div><div class='audio-row'><span>with BGM</span><audio controls src='$($voice.Id)_bgm.mp3'></audio></div><p class='id'>$($voice.Id)</p></article>")
}
$html = @"
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Windows System Voice Audition</title><style>body{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}.wrap{max-width:1120px;margin:0 auto;padding:34px}.lead{font-size:18px;line-height:1.7;color:#635649}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:16px}.card{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}h1{font-size:34px}h2{font-size:22px;margin:0 0 8px}small{font-size:13px;color:#937f68}.audio-row{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}.audio-row span{font-weight:800;color:#7a5d35}audio{width:100%}.id{font-size:12px;color:#9a8a77}</style></head><body><main class="wrap"><h1>Windows System Voice Audition</h1><p class="lead">These are local Windows SAPI voices, not the rejected Edge/Google online voices. There are fewer options, but the timbre is different and can be used as another reference set.</p><section class="grid">$($cards -join "`n")</section></main></body></html>
"@
[System.IO.File]::WriteAllText((Join-Path $OutDir 'index.html'), $html, [System.Text.UTF8Encoding]::new($false))
Get-Item -LiteralPath (Join-Path $OutDir 'index.html')
`;
writeFileSync('H:/ccwork/MBTI-PRO/scripts/video-pipeline/generate-system-voice-audition.ps1', finalPs1, {encoding:'utf8'});
