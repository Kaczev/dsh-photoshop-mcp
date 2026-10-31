param([string]$Action = 'inspect', [string]$Handle = '', [string]$ExpectedText = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class DshWindows {
 public delegate bool Callback(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
 public static string Text(IntPtr h) { var s=new StringBuilder(4096); GetWindowText(h,s,s.Capacity); return s.ToString(); }
 public static string Class(IntPtr h) { var s=new StringBuilder(256); GetClassName(h,s,s.Capacity); return s.ToString(); }
}
'@
$pids = @(Get-Process Photoshop -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$dialogs = [System.Collections.Generic.List[object]]::new()
[DshWindows]::EnumWindows({param($h,$p)
 [uint32]$processId = 0
 [void][DshWindows]::GetWindowThreadProcessId($h,[ref]$processId)
 if ($processId -notin $pids -or ![DshWindows]::IsWindowVisible($h)) { return $true }
 $owner = [DshWindows]::GetWindow($h,4)
 $kind = [DshWindows]::Class($h)
 [uint32]$ownerPid = 0
 if ($owner -ne [IntPtr]::Zero) { [void][DshWindows]::GetWindowThreadProcessId($owner,[ref]$ownerPid) }
 $blocking = ($ownerPid -in $pids -and ![DshWindows]::IsWindowEnabled($owner)) -or $kind -eq '#32770'
 if (!$blocking) { return $true }
 $controls = [System.Collections.Generic.List[object]]::new()
 [void][DshWindows]::EnumChildWindows($h,{param($c,$p2)
  if ([DshWindows]::IsWindowVisible($c)) {
   $controls.Add(@{handle=$c.ToInt64().ToString();class=[DshWindows]::Class($c);text=[DshWindows]::Text($c);id=[DshWindows]::GetDlgCtrlID($c);enabled=[DshWindows]::IsWindowEnabled($c)})
  }
  return $true
 },[IntPtr]::Zero)
 if ($blocking -and $kind -ne '#32770') {
  try {
   Add-Type -AssemblyName UIAutomationClient
   Add-Type -AssemblyName UIAutomationTypes
   $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
   $nodes = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
   $count = [Math]::Min($nodes.Count,128)
   for ($i=0; $i -lt $count; $i++) {
    $current=$nodes.Item($i).Current
    if ($current.Name) { $controls.Add(@{handle='';class=('UIA.'+$current.ControlType.ProgrammaticName);text=$current.Name;id=0;enabled=$current.IsEnabled}) }
   }
  } catch { $controls.Add(@{handle='';class='Diagnostic';text=$_.Exception.Message;id=0;enabled=$false}) }
 }
 if ($kind -in @('OWL.ShadowView','OWL.FrameDrawer') -and $controls.Count -eq 0) { return $true }
 $dialogs.Add(@{handle=$h.ToInt64().ToString();pid=$processId;title=[DshWindows]::Text($h);class=$kind;blocking=$blocking;controls=@($controls.ToArray())})
 return $true
},[IntPtr]::Zero) | Out-Null
if ($Action -eq 'dismiss') {
 $d = @($dialogs | Where-Object { $_.handle -eq $Handle })
 if ($d.Count -ne 1) { throw 'Dialog changed or disappeared' }
 $d=$d[0]
 $buttons=@($d.controls | Where-Object { $_.class -eq 'Button' })
 $texts=(@($d.controls | Where-Object { $_.class -eq 'Static' } | ForEach-Object { $_.text } | Where-Object { $_ }) -join "`n").Trim()
 $known = $texts -match '^(\u627e\u4e0d\u5230\u8981\u79fb\u53bb\u7684\u80cc\u666f[\u3002.]?|Could not find (a |the )?background to remove[.!]?)$'
 $interactive=@($d.controls | Where-Object { $_.class -notin @('Static','Button') })
 if ($d.class -ne '#32770' -or $d.title -ne 'Adobe Photoshop' -or !$known -or $texts -cne $ExpectedText -or $buttons.Count -ne 1 -or $interactive.Count -ne 0 -or $buttons[0].id -notin @(1,2) -or !$buttons[0].enabled -or $buttons[0].text -notmatch '^(\u786e\u5b9a|OK)\s*(&[A-Za-z]|\(&?[A-Za-z]\))?$') { throw 'Dialog is not an allowlisted error acknowledgment' }
 if (![DshWindows]::PostMessage([IntPtr][long]$buttons[0].handle,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'Could not post button click' }
 @{requested=$true;handle=$Handle} | ConvertTo-Json -Compress
} else { @{dialogs=@($dialogs.ToArray())} | ConvertTo-Json -Depth 6 -Compress }
