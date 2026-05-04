import { useEffect } from 'react';
import { useStore } from '@/store';

function isEditableTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

export function useSceneShortcuts() {
  const dispatch = useStore((s) => s.sceneDispatch);
  const undo = useStore((s) => s.sceneUndo);
  const redo = useStore((s) => s.sceneRedo);
  const setPlacement = useStore((s) => s.editorSetPlacement);
  const newFixtureId = useStore((s) => s.newFixtureId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const selectedId = useStore.getState().scene.doc.selectedFixtureId;

      // Esc → cancel placement and selection.
      if (e.key === 'Escape') {
        setPlacement(null);
        dispatch({ type: 'selection.set', id: null });
        return;
      }

      // Delete / Backspace → delete selected fixture.
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        dispatch({ type: 'fixture.remove', id: selectedId });
        return;
      }

      // Cmd/Ctrl+D → duplicate selected fixture.
      if (mod && e.key.toLowerCase() === 'd' && selectedId) {
        e.preventDefault();
        dispatch({
          type: 'fixture.duplicate',
          id: selectedId,
          newId: newFixtureId(),
        });
        return;
      }

      // Cmd/Ctrl+Z (and Cmd/Ctrl+Shift+Z) for undo/redo.
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Cmd/Ctrl+Y → redo (Windows-style).
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, undo, redo, setPlacement, newFixtureId]);
}