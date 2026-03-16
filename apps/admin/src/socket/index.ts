/**
 * WebSocket Connection Management Module for Admin Panel
 *
 * Uses socket.io-client with auto-reconnect and exponential backoff.
 * Requires explicit connect() call - does NOT auto-connect on module load.
 */
import { io, Socket } from 'socket.io-client';
import { refreshAccessToken, redirectToLogin } from '@/api';

// Token key must match the one used in auth store
const ACCESS_TOKEN_KEY = 'admin-access-token';

// Reconnection configuration
const MAX_RETRIES = 3;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 10000; // 10 seconds

// Socket instance (singleton)
let socket: Socket | null = null;
let retryCount = 0;
let isConnecting = false;
let isRefreshingToken = false;

// Reconnect callback - called when socket reconnects successfully
let onReconnectCallback: (() => void) | null = null;

// Token refresh callback - called when token needs to be refreshed for re-authentication
let onTokenRefreshCallback: (() => Promise<string | null>) | null = null;

/**
 * Get the WebSocket URL from environment variable
 */
function getSocketUrl(): string {
  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  if (!socketUrl) {
    console.warn('[Socket] VITE_SOCKET_URL is not defined');
    return '';
  }
  return socketUrl;
}

/**
 * Get the access token from localStorage
 */
function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Calculate reconnection delay with exponential backoff
 */
function calculateReconnectDelay(): number {
  const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, retryCount), MAX_RECONNECT_DELAY);
  // Add jitter (±20%) to prevent thundering herd
  return delay * (0.8 + Math.random() * 0.4);
}

/**
 * Set reconnect callback - called when socket reconnects successfully
 */
export function setOnReconnect(callback: (() => void) | null): void {
  onReconnectCallback = callback;
}

/**
 * Set token refresh callback - called to get fresh token for re-authentication
 */
export function setOnTokenRefresh(callback: (() => Promise<string | null>) | null): void {
  onTokenRefreshCallback = callback;
}

/**
 * Check if socket is connected
 */
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Get the current socket instance
 * Returns null if not connected
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Connect to WebSocket server
 * @returns Promise that resolves when connected, rejects on failure
 */
export function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // Already connected
    if (socket?.connected) {
      resolve(socket);
      return;
    }

    // Already connecting
    if (isConnecting) {
      reject(new Error('[Socket] Connection already in progress'));
      return;
    }

    const token = getAccessToken();
    if (!token) {
      reject(new Error('[Socket] No access token found'));
      return;
    }

    // 调试: 打印 token 信息 (不打印完整 token，只显示前后几位)
    console.log(`[Socket] Connecting with token: ${token.slice(0, 10)}...${token.slice(-6)}`);

    const socketUrl = getSocketUrl();
    if (!socketUrl) {
      reject(new Error('[Socket] VITE_SOCKET_URL is not configured'));
      return;
    }

    isConnecting = true;

    // Create socket connection
    socket = io(`${socketUrl}/chat`, {
      auth: {
        token,
      },
      autoConnect: true,
      reconnection: false, // We handle reconnection manually
    });

    // Connection successful
    socket.on('connect', async () => {
      console.log('[Socket] Connected successfully');
      isConnecting = false;
      const wasReconnect = retryCount > 0;
      retryCount = 0;

      // Emit connection event as per design spec
      socket?.emit('connection');

      // Handle re-authentication on reconnect
      if (wasReconnect && onTokenRefreshCallback) {
        try {
          const freshToken = await onTokenRefreshCallback();
          if (freshToken && socket) {
            socket.emit('reauthenticate', { token: freshToken });
            console.log('[Socket] Re-authenticated with fresh token');
          }
        } catch (err) {
          console.error('[Socket] Token refresh failed:', err);
        }
      }

      // Notify reconnect callback (for processing pending messages)
      if (wasReconnect && onReconnectCallback) {
        onReconnectCallback();
      }

      resolve(socket!);
    });

    // Handle connection event from server
    socket.on('connection', (data: { message: string; userId: string; timestamp: string }) => {
      console.log('[Socket] Server acknowledged connection:', data);
    });

    // Connection error
    socket.on('connect_error', (error: Error) => {
      console.error('[Socket] Connection error:', error.message);
      isConnecting = false;

      // Attempt reconnection with exponential backoff
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = calculateReconnectDelay();
        console.log(
          `[Socket] Retrying connection (${retryCount}/${MAX_RETRIES}) in ${Math.round(delay)}ms`
        );

        setTimeout(() => {
          connect().then(resolve).catch(reject);
        }, delay);
      } else {
        console.error(`[Socket] Max retries (${MAX_RETRIES}) exceeded`);
        socket = null;
        reject(new Error(`[Socket] Connection failed after ${MAX_RETRIES} retries`));
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason: Socket.DisconnectReason) => {
      console.log('[Socket] Disconnected:', reason);
      isConnecting = false;

      // Auto-reconnect on certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't auto-reconnect
        socket = null;
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Connection lost, attempt to reconnect
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = calculateReconnectDelay();
          console.log(
            `[Socket] Reconnecting after disconnect (${retryCount}/${MAX_RETRIES}) in ${Math.round(delay)}ms`
          );

          setTimeout(() => {
            connect().catch((err) => console.error('[Socket] Reconnection failed:', err));
          }, delay);
        }
      }
    });

    // Handle errors from server
    socket.on('error', async (error: { message: string }) => {
      console.error('[Socket] Server error:', error.message);
      console.error('[Socket] Error details:', error);

      // Check for token expiry error
      if (error.message?.includes('Invalid or expired token')) {
        // Prevent concurrent refresh attempts
        if (isRefreshingToken) {
          console.log('[Socket] Token refresh already in progress, skipping');
          return;
        }

        isRefreshingToken = true;
        console.log('[Socket] Token expired, attempting to refresh...');

        try {
          const newToken = await refreshAccessToken();

          if (newToken) {
            // Update localStorage with new token
            localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
            console.log('[Socket] Token refreshed successfully');

            // Disconnect current socket
            if (socket) {
              socket.disconnect();
              socket = null;
            }

            // Reconnect with new token
            isRefreshingToken = false;
            await connect();
          } else {
            // Refresh failed, redirect to login
            console.error('[Socket] Token refresh failed, redirecting to login');
            isRefreshingToken = false;
            redirectToLogin();
          }
        } catch (err) {
          console.error('[Socket] Token refresh error:', err);
          isRefreshingToken = false;
          redirectToLogin();
        }
      }
    });
  });
}

/**
 * Disconnect from WebSocket server
 */
export function disconnect(): void {
  if (socket) {
    console.log('[Socket] Disconnecting...');
    socket.disconnect();
    socket = null;
    isConnecting = false;
    retryCount = 0;
  }
}
