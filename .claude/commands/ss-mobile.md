# Mobile Screenshot Capture

Capture a screenshot from the connected mobile device for visual debugging.

## Instructions

1. First, trigger the screenshot capture on the mobile device:

```bash
curl -X POST http://localhost:4000/api/debug/screenshot/request
```

2. Wait 3 seconds for the mobile app to capture and upload the screenshot.

3. Read and display the screenshot from `priv/debug_screenshots/latest.png`

4. Also read the metadata from `priv/debug_screenshots/latest.json` to show context (player name, room, timestamp).

5. After displaying the screenshot, ask the user: "What would you like to change about this screen?"

## Important

- The mobile app must be running and connected to the game channel
- The screenshot will capture the current state of the game screen
- If no screenshot is available, inform the user to ensure the mobile app is running
