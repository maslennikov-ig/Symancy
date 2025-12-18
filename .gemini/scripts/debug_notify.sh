#!/bin/bash

# Debug script for Windows Notification
# Runs synchronously and prints all output

MESSAGE="Debug Notification"
TITLE="Debug"

SAFE_MSG=$(echo "$MESSAGE" | sed "s/'/''/g")
SAFE_TITLE=$(echo "$TITLE" | sed "s/'/''/g")

PS_COMMAND="
Add-Type -AssemblyName PresentationFramework;
[System.Windows.MessageBox]::Show('$SAFE_MSG', '$SAFE_TITLE', 'OK', 'Information', 'OK', 'DefaultDesktopOnly');
"

echo "1. Encoding Command..."
# Encode to Base64 (UTF-16LE)
ENCODED_CMD=$(echo -n "$PS_COMMAND" | iconv -t UTF-16LE | base64 -w 0)
echo "   Encoded length: ${#ENCODED_CMD}"

echo "2. Checking powershell.exe..."
if command -v powershell.exe &> /dev/null; then
    echo "   Found at: $(which powershell.exe)"
    
    echo "3. Running PowerShell directly (Foreground)..."
    echo "   Please look at your Windows Taskbar/Screen."
    
    # Run directly without cmd /c start to see errors
    powershell.exe -NoProfile -NonInteractive -Sta -EncodedCommand "$ENCODED_CMD"
    
    EXIT_CODE=$?
    echo "4. PowerShell exited with code: $EXIT_CODE"
else
    echo "   Error: powershell.exe not found!"
fi
