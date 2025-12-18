#!/bin/bash

# Test script for notify_windows.sh

# Create a temporary wrapper script to run the test in a controlled environment
cat > .gemini/tests/wrapper.sh << 'EOF'
#!/bin/bash

# Mock powershell.exe as a function
# Bash functions are detected by 'command -v'
function powershell.exe() {
    echo "MOCK_POWERSHELL_CALLED" >&2
    local encoded=""
    while [[ "$#" -gt 0 ]]; do
        case $1 in
            -EncodedCommand) encoded="$2"; shift ;;
            *) ;;
        esac
        shift
    done
    
    if [ -n "$encoded" ]; then
        # Decode to verify the logic
        # We decode Base64 -> UTF-16LE -> UTF-8
        echo "$encoded" | base64 -d | iconv -f UTF-16LE -t UTF-8 > .gemini/tests/captured_cmd.txt
    fi
}

export -f powershell.exe

# Source the script to test it
# We need to skip the shebang line if we were catting it, but sourcing works if it's valid bash.
# The script checks 'command -v powershell.exe'. In bash, this returns true for functions.
# However, we must ensure the script doesn't exit on us.
# The original script has 'exit 1' on failure.

# Run the script
# We pass arguments "Test Message" "Test Title"
source .gemini/scripts/notify_windows.sh "Test Message" "Test Title"

# Wait for background jobs (the mocked powershell.exe) to finish
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
# The script constructs this string:
EXPECTED="Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Test Message', 'Test Title')"

echo "---------------------------------------------------"
echo "Expected: $EXPECTED"
echo "Actual:   $CAPTURED"
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