# Bring a session's terminal window to the front. Called by the server for POST /focus/<session>.
# Prints one word: focused | flashed (Windows let us only flash the taskbar button) | gone (no such window).
param([long]$Hwnd = 0, [int]$ProcessId = 0)
Add-Type -Namespace Yard -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
'@
$h = [IntPtr]$Hwnd
if ($Hwnd -eq 0 -or -not [Yard.Win]::IsWindow($h)) {
  # The handle went stale (terminal restarted): fall back to the process's current main window.
  $p = if ($ProcessId) { Get-Process -Id $ProcessId -ErrorAction SilentlyContinue } else { $null }
  if ($p -and $p.MainWindowHandle -ne 0) { $h = $p.MainWindowHandle } else { Write-Output 'gone'; exit 0 }
}
$front = { [Yard.Win]::GetForegroundWindow().ToInt64() -eq $h.ToInt64() }
if ([Yard.Win]::IsIconic($h)) { [Yard.Win]::ShowWindow($h, 9) | Out-Null }   # SW_RESTORE
[Yard.Win]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 120
if (-not (& $front)) {
  # A background process may only flash the taskbar button; a window restored from minimized is allowed to take the front.
  [Yard.Win]::ShowWindow($h, 6) | Out-Null   # SW_MINIMIZE
  Start-Sleep -Milliseconds 80
  [Yard.Win]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
  [Yard.Win]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 150
}
if (& $front) { Write-Output 'focused' } else { Write-Output 'flashed' }
