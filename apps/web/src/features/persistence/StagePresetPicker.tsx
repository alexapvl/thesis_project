import type { ChangeEvent } from 'react';
import { parseSceneDocument } from '@stl/fixtures';
import { useStore } from '@/store';
import { STAGE_PRESETS } from '@/stages';

export function StagePresetPicker() {
  const sceneReplace = useStore((s) => s.sceneReplace);
  const debugLog = useStore((s) => s.debugLog);

  function onChange(ev: ChangeEvent<HTMLSelectElement>) {
    const id = ev.target.value;
    ev.target.value = '';
    if (!id) return;
    const preset = STAGE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const result = parseSceneDocument(preset.doc);
    if (!result.ok) {
      debugLog('error', `preset "${id}" invalid: ${result.error.slice(0, 120)}`);
      return;
    }
    sceneReplace(result.value);
    debugLog('info', `loaded preset ${preset.label} (${result.value.fixtures.length} fixtures)`);
  }

  return (
    <select
      className="stage-preset"
      defaultValue=""
      onChange={onChange}
      title="Load a predefined stage (replaces the current scene; undoable)"
    >
      <option value="" disabled>
        Load stage…
      </option>
      {STAGE_PRESETS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
