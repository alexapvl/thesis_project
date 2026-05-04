import { useEffect } from 'react';
import { useStore } from '@/store';
import { saveAutosave } from './storage';

const DEBOUNCE_MS = 500;

export function useAutosave() {
  const markAutosave = useStore((s) => s.persistenceMarkAutosave);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = useStore.subscribe(
      (s) => s.scene.doc,
      (doc) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          saveAutosave(doc);
          markAutosave();
        }, DEBOUNCE_MS);
      },
    );
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [markAutosave]);
}