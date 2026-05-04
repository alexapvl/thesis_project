import { useRef } from 'react';
import { parseSceneDocument } from '@stl/fixtures';
import { useStore } from '@/store';

export function PersistenceControls() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sceneReplace = useStore((s) => s.sceneReplace);
  const importErr = useStore((s) => s.persistence.lastImportError);
  const setImportErr = useStore((s) => s.persistenceSetImportError);
  const debugLog = useStore((s) => s.debugLog);

  function onExport() {
    const doc = useStore.getState().scene.doc;
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (doc.name || 'scene').replace(/[^a-z0-9-_]+/gi, '_');
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    debugLog('info', `exported scene ${doc.id} (${doc.fixtures.length} fixtures)`);
  }

  async function onImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    ev.target.value = '';
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = parseSceneDocument(json);
      if (!result.ok) {
        setImportErr(result.error);
        debugLog('error', `import rejected: ${result.error.slice(0, 120)}`);
        return;
      }
      sceneReplace(result.value);
      setImportErr(null);
      debugLog('info', `imported scene ${result.value.id} (${result.value.fixtures.length} fixtures)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setImportErr(msg);
      debugLog('error', `import failed: ${msg}`);
    }
  }

  return (
    <div className="persistence">
      <button type="button" onClick={onExport}>Export JSON</button>
      <button type="button" onClick={() => inputRef.current?.click()}>Import JSON</button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onImport}
      />
      {importErr && (
        <div className="persistence-err" title={importErr}>
          import error
        </div>
      )}
    </div>
  );
}