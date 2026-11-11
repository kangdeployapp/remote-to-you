; Inno Setup Script for Remote to You Windows Application
; Supports Dual Mode: Per-User and Per-Machine (Administrator) installation with Windows Service support

#define MyAppName "Remote to You"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Remote to You Engineering"
#define MyAppURL "https://remotetoyou.local"
#define MyAppExeName "remote-to-you.exe"

[Setup]
AppId={{D37F6C12-9A4E-4B7C-901D-21D8A90B1E63}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=RemoteToYou-Setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequiredOverridesAllowed=dialog
PrivilegesRequired=lowest
SetupIconFile=..\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startwithwindows"; Description: "Start RemoteDesk on Windows startup (Recommended for Unattended Access)"; GroupDescription: "System Integration:"
Name: "installsystemservice"; Description: "Register Windows Unattended Service (Requires Administrator privileges for Session 0 & UAC traversal)"; GroupDescription: "System Integration:"; Flags: unchecked

[Files]
Source: "..\src-tauri\target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src-tauri\icons\*"; DestDir: "{app}\icons"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"" --tray"; Flags: uninsdeletevalue; Tasks: startwithwindows and installsystemservice
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"" --tray"; Flags: uninsdeletevalue; Tasks: startwithwindows and not installsystemservice

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--install-service"; Flags: runascurrentuser; Tasks: installsystemservice; StatusMsg: "Configuring Windows RemoteDesk Session 0 Service..."
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--uninstall-service"; Flags: runhidden
