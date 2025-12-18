#!/bin/bash

# Test script for notify_windows.sh (Golden Path Implementation)

# Create a temporary wrapper script to run the test in a controlled environment
cat > .gemini/tests/wrapper.sh << 'EOF'
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
EOF

chmod +x .gemini/tests/wrapper.sh

# Clean previous run
rm -f .gemini/tests/captured_cmd.txt

# Run the wrapper
./.gemini/tests/wrapper.sh

# Check if file was created
if [ ! -f .gemini/tests/captured_cmd.txt ]; then
    echo "❌ Test Failed: captured_cmd.txt not found. Script might have failed early."
    exit 1
fi

# Verify content
CAPTURED=$(cat .gemini/tests/captured_cmd.txt)
# The new script uses a more complex PowerShell command with specific flags
EXPECTED="[System.Windows.MessageBox]::Show('Test Message', 'Test Title', 'OK', 'Information', 'OK', 'DefaultDesktopOnly');"

echo "---------------------------------------------------"
echo "Expected to contain: $EXPECTED"
echo "Actual:              $CAPTURED"
echo "---------------------------------------------------"

# Compare
if [[ "$CAPTURED" == *"$EXPECTED"* ]]; then
    echo "✅ Test Passed"
    rm .gemini/tests/wrapper.sh .gemini/tests/captured_cmd.txt
    exit 0
else
    echo "❌ Test Failed: Content mismatch"
    exit 1
fi
