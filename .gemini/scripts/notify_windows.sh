#!/bin/bash

# Notify Windows User via PowerShell
# Usage: ./notify_windows.sh "Message" "Title"

MSG="${1:-Notification}"
TITLE="${2:-Gemini CLI}"

# Escape single quotes for PowerShell ( ' -> '' )
MSG_ESCAPED=${MSG//"'"/"''"}
TITLE_ESCAPED=${TITLE//"'"/"''"}

# PowerShell command to show message box
PS_CMD="Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('$MSG_ESCAPED', '$TITLE_ESCAPED')"

# Check if iconv is available
if ! command -v iconv &> /dev/null; then
    echo "Error: iconv is required for encoding."
    exit 1
fi

# Encode to UTF-16LE then Base64
# PowerShell requires UTF-16LE for EncodedCommand
ENCODED=$(printf "%s" "$PS_CMD" | iconv -t UTF-16LE | base64 -w 0)

# Run powershell with encoded command in background
# > /dev/null 2>&1 to silence output and & to background it
if command -v powershell.exe &> /dev/null; then
    powershell.exe -NoProfile -EncodedCommand "$ENCODED" > /dev/null 2>&1 &
    echo "Notification sent to Windows."
else
    echo "Error: powershell.exe not found. Are you on WSL?"
    exit 1
fi
