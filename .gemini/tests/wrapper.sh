#!/bin/bash

# Mock cmd.exe as a function because the script now calls 'cmd.exe /c start ...'
function cmd.exe() {
    echo "MOCK_CMD_CALLED" >&2
    
    # We expect arguments: /c start /min "" powershell.exe ... -EncodedCommand ENCODED ...
    # We need to find the encoded string in the arguments.
    
    local encoded=""
    local next_is_encoded=false
    
    for arg in "$@"; do
        if [ "$next_is_encoded" = true ]; then
            encoded="$arg"
            break
        fi
        
        if [ "$arg" == "-EncodedCommand" ]; then
            next_is_encoded=true
        fi
    done
    
    if [ -n "$encoded" ]; then
        # Decode to verify the logic
        # Base64 -> UTF-16LE -> UTF-8
        echo "$encoded" | base64 -d | iconv -f UTF-16LE -t UTF-8 > .gemini/tests/captured_cmd.txt
    fi
}

export -f cmd.exe

# Run the script
source .gemini/scripts/notify_windows.sh "Test Message" "Test Title"

# Wait for background jobs to finish
wait
