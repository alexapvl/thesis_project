import { useEffect } from 'react';
import { sessionController } from './sessionController';

/**
 * Boots the singleton SessionController once at app mount. The controller
 * owns the WebSocket lifecycle; status transitions and downstream messages
 * flow into the Zustand store from inside the controller.
 */
export function useTransportBoot() {
  useEffect(() => {
    sessionController.boot();
    return () => {
      sessionController.shutdown();
    };
  }, []);
}
