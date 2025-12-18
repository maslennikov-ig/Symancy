#!/bin/bash

# Function: notify_windows
# Description: Sends a reliable, non-blocking Windows notification from WSL2.
# Based on deep research into WSL/Windows Interop deadlocks and session isolation.

# 1. Capture Arguments
MESSAGE="${1:-The release script completed successfully.}"
TITLE="${2:-Release Manager}"

# 2. Sanitize Strings for PowerShell
#    PowerShell uses single quotes for string literals. If the message contains 
#    a single quote (e.g. "User's PC"), it breaks the syntax.
#    We use sed to escape single quotes by doubling them (' becomes '').
SAFE_MSG=$(echo "$MESSAGE" | sed "s/'/''/g")
SAFE_TITLE=$(echo "$TITLE" | sed "s/'/''/g")

# 3. Construct the Raw PowerShell Command
#    We use Add-Type to load the WPF framework.
#    We use ::Show with specific flags to ensure visibility:
#    - 'OK' button only
#    - 'Information' icon
#    - 'OK' default result
#    - 'DefaultDesktopOnly' (0x20000) is the CRITICAL flag. It forces the 
#      window to the active user desktop, bypassing session isolation issues
#      that often make background alerts invisible.
PS_COMMAND="
Add-Type -AssemblyName PresentationFramework;
[System.Windows.MessageBox]::Show('$SAFE_MSG', '$SAFE_TITLE', 'OK', 'Information', 'OK', 'DefaultDesktopOnly');
"

# 4. Encode to Base64 (UTF-16LE)
#    PowerShell -EncodedCommand requires UTF-16 Little Endian encoding.
#    This bypasses all shell quoting hell and special character issues.
ENCODED_CMD=$(echo -n "$PS_COMMAND" | iconv -t UTF-16LE | base64 -w 0)

# 5. Execute Detached via cmd.exe ("Fire and Forget")
#    cmd.exe /c start    : Tells Windows to spawn a completely separate process tree.
#                          This "orphans" the process, so it survives when this bash script exits.
#    /min ""             : Starts the launcher minimized with empty title (reduces flash).
#    powershell.exe      : The actual app.
#    -WindowStyle Hidden : Hides the PowerShell console window.
#    -NoProfile          : Faster startup, no user profile loading.
#    -NonInteractive     : Prevents hanging on prompts.
#    -Sta                : Single Threaded Apartment mode (REQUIRED for WPF/GUI to work reliably).
#    -EncodedCommand     : Passes our complex command safely.
#    < /dev/null         : CRITICAL. Closes stdin to prevent IO hangs.
#    > /dev/null 2>&1    : Silences all output to prevent buffer deadlocks.

if command -v cmd.exe &> /dev/null; then
    cmd.exe /c start /min "" powershell.exe \
        -NoProfile \
        -NonInteractive \
        -WindowStyle Hidden \
        -Sta \
        -EncodedCommand "$ENCODED_CMD" \
        < /dev/null > /dev/null 2>&1 &
    
    echo "Notification sent to Windows (Detached)."
else
    echo "Error: cmd.exe not found. This script requires WSL/Windows."
    exit 1
fi

exit 0