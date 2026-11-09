import { useRef, useState } from 'react';

export function useSaveAndClose() {
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const saveAndClose = async (save: () => void | Promise<void>, close: () => void) => {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setSaveError('');
    try {
      await save();
      close();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Salvataggio non riuscito. Riprova.');
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };
  return { saveAndClose, saveError, isSaving, clearSaveError: () => setSaveError('') };
}
