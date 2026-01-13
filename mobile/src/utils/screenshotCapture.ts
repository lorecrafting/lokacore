/**
 * Screenshot Capture Utility
 *
 * Listens for capture_screenshot events from the server and
 * captures + uploads the current screen.
 *
 * Usage:
 *   import { initScreenshotCapture } from '@/utils/screenshotCapture';
 *
 *   // In your app, after channel is connected:
 *   initScreenshotCapture(channel, viewRef, serverUrl, playerName);
 */

import { captureRef } from 'react-native-view-shot';
import { Alert } from 'react-native';
import type { Channel } from 'phoenix';
import type { RefObject } from 'react';
import type { View } from 'react-native';

let isInitialized = false;
let currentChannel: Channel | null = null;
let currentViewRef: RefObject<View | null> | null = null;
let currentServerUrl: string = '';
let currentPlayerName: string = '';
let currentRoom: string = '';

/**
 * Initialize screenshot capture listener
 */
export function initScreenshotCapture(
  channel: Channel,
  viewRef: RefObject<View | null>,
  serverUrl: string,
  playerName?: string
) {
  // Always clean up and reinitialize on new channel
  if (currentChannel && currentChannel !== channel) {
    currentChannel.off('capture_screenshot');
  }

  currentChannel = channel;
  currentViewRef = viewRef;
  currentServerUrl = serverUrl;
  currentPlayerName = playerName || 'unknown';

  // Listen for capture request from server
  channel.on('capture_screenshot', async (_payload: unknown) => {
    console.log('[Screenshot] Capture request received');
    await captureAndUpload();
  });

  isInitialized = true;
  console.log('[Screenshot] Capture listener initialized');
}

/**
 * Update player name (call after auth)
 */
export function setScreenshotPlayerName(name: string) {
  currentPlayerName = name;
}

/**
 * Update current room (call on navigation)
 */
export function setScreenshotRoom(room: string) {
  currentRoom = room;
}

/**
 * Manually trigger screenshot capture and upload
 */
export async function captureAndUpload(): Promise<boolean> {
  if (!currentViewRef?.current) {
    console.error('[Screenshot] No view ref available');
    return false;
  }

  try {
    // Capture the screen
    const uri = await captureRef(currentViewRef, {
      format: 'png',
      quality: 0.9,
      result: 'base64',
    });

    console.log('[Screenshot] Captured, uploading...');

    // Upload to server
    const response = await fetch(`${currentServerUrl}/api/debug/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: uri,
        player_name: currentPlayerName,
        room: currentRoom,
        device: `${require('react-native').Platform.OS}`,
        timestamp: Date.now(),
      }),
    });

    if (response.ok) {
      console.log('[Screenshot] Upload successful');
      // Brief visual feedback (optional)
      // You could trigger a toast notification here
      return true;
    } else {
      const error = await response.text();
      console.error('[Screenshot] Upload failed:', error);
      return false;
    }
  } catch (error) {
    console.error('[Screenshot] Capture error:', error);
    return false;
  }
}

/**
 * Cleanup - call when channel disconnects
 */
export function cleanupScreenshotCapture() {
  if (currentChannel) {
    currentChannel.off('capture_screenshot');
  }
  currentChannel = null;
  currentViewRef = null;
  isInitialized = false;
}
