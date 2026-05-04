import { useEffect } from 'react';
import { useStore } from '@/store';
import { loadAutosave } from './storage';

export function useHydrate() {
  const sceneReplace = useStore((s) => s.sceneReplace);
  const debugLog = useStore((s) => s.debugLog);

  useEffect(() => {
    const restored = loadAutosave();
    if (restored) {
      sceneReplace(restored);
      debugLog('info', `restored scene ${restored.id} (${restored.fixtures.length} fixtures)`);
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}