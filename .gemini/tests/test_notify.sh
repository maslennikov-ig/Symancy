#!/bin/bash

# Test script for notify_windows.sh (Golden Path Implementation)

# Setup a temporary bin directory
TEST_BIN="$PWD/.gemini/tests/bin"
mkdir -p "$TEST_BIN"

# Create a mock cmd.exe script
cat > "$TEST_BIN/cmd.exe" << 'EOF'
#!/bin/bash
echo "MOCK_CMD_CALLED" >&2

# Parse arguments to find encoded command
encoded=""
next_is_encoded=false

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
    # Decode: Base64 -> UTF-16LE -> UTF-8
    # Save to a fixed location we know about
    # $PWD will be the root where test is run
    echo "$encoded" | base64 -d | iconv -f UTF-16LE -t UTF-8 > .gemini/tests/captured_cmd.txt
fi
EOF

chmod +x "$TEST_BIN/cmd.exe"

# Create the wrapper that sets PATH
cat > .gemini/tests/wrapper.sh << EOF
#!/bin/bash
export PATH="$TEST_BIN:\$PATH"

# Run the script
# We source it so we can easily wait for it, but executing it is also fine since we intercept cmd.exe
# Let's execute it to be closer to real usage.
bash .gemini/scripts/notify_windows.sh "Test Message" "Test Title"

# Wait for any background jobs (though bash script exits, the background job cmd.exe might still be running?)
# Actually, the script exits. The background job (cmd.exe) is a child of the script.
# When script exits, we can't 'wait' for it from here unless we sourced it.
# BUT, our mock cmd.exe writes to a file. We just need to wait a bit or ensure it runs.
# Since the script backgrounds cmd.exe, and cmd.exe is a bash script, it will run.
# We'll add a small sleep to ensure filesystem sync.
sleep 1
EOF

chmod +x .gemini/tests/wrapper.sh

# Clean previous run
rm -f .gemini/tests/captured_cmd.txt

# Run the wrapper
./.gemini/tests/wrapper.sh

# Cleanup
rm -rf "$TEST_BIN"

# Check if file was created
if [ ! -f .gemini/tests/captured_cmd.txt ]; then
    echo "❌ Test Failed: captured_cmd.txt not found."
    exit 1
fi

# Verify content
CAPTURED=$(cat .gemini/tests/captured_cmd.txt)
EXPECTED="[System.Windows.MessageBox]::Show('Test Message', 'Test Title', 'OK', 'Information', 'OK', 'DefaultDesktopOnly');"

echo "---------------------------------------------------"
echo "Expected snippet: ...DefaultDesktopOnly');"
echo "Actual:           $CAPTURED"
echo "---------------------------------------------------"

if [[ "$CAPTURED" == *"$EXPECTED"* ]]; then
    echo "✅ Test Passed"
    rm .gemini/tests/wrapper.sh .gemini/tests/captured_cmd.txt
    exit 0
else
    echo "❌ Test Failed: Content mismatch"
    exit 1
fi