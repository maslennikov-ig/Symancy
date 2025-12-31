import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export function useConfigUpdate<T>(
  initialValue: T,
  configKey: string,
  onUpdate: (key: string, value: unknown) => Promise<void>,
  successMessage: string
) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  // Use ref to track initial value without causing callback recreation
  const initialValueRef = useRef(initialValue);

  // Sync with prop changes
  useEffect(() => {
    setValue(initialValue);
    initialValueRef.current = initialValue;
  }, [initialValue]);

  const handleUpdate = useCallback(async (newValue: T) => {
    setValue(newValue);
    setSaving(true);
    try {
      await onUpdate(configKey, newValue);
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : `Failed to update ${configKey}`;
      toast.error('Failed to update', { description: message });
      setValue(initialValueRef.current); // Use ref instead of initialValue
    } finally {
      setSaving(false);
    }
  }, [configKey, onUpdate, successMessage]); // Remove initialValue from deps

  return { value, setValue, saving, handleUpdate };
}
