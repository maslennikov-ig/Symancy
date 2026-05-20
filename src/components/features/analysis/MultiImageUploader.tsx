import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { UploadIcon } from '../../icons/UploadIcon';
import { cn } from '../../../lib/utils';

/**
 * Allowed mime-types for uploaded coffee cup photos.
 *
 * Note: HEIC/HEIF are intentionally NOT supported — the Vision API used by
 * the Edge Function rejects HEIC payloads. We surface a dedicated error
 * message when a user tries to upload one (detected via extension, since
 * some browsers report empty mime for HEIC files).
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * File extensions that indicate an HEIC/HEIF image. Detected separately so
 * we can show a user-friendly "not supported" message instead of a generic
 * invalid-type error.
 */
const HEIC_EXTENSION_RE = /\.(heic|heif)$/i;

/**
 * Maximum file size per image (10 MB).
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Translation function type — kept loose (string keys) for consistency with
 * other analysis-feature components (see `ImageUploader.tsx`, `PersonaSelector.tsx`).
 */
type TranslateFn = (key: string) => string;

/**
 * Slot identifier used internally to distinguish the two upload slots.
 */
type SlotId = 'first' | 'second';

/**
 * Props for the `MultiImageUploader` component.
 *
 * The component is purely presentational: it owns selection / preview / validation
 * state for two coffee-cup photos and bubbles the final pair to the parent via
 * `onImagesReady` once the user clicks the "compare" CTA.
 */
export interface MultiImageUploaderProps {
  /** Callback fired when the user confirms both selected images. */
  onImagesReady: (firstImage: File, secondImage: File) => void;
  /** Optional callback fired when the user resets both slots. */
  onClear?: () => void;
  /** Disables every interactive element of the uploader. */
  disabled?: boolean;
  /** Optional override for the first slot label (defaults to i18n value). */
  firstLabel?: string;
  /** Optional override for the second slot label (defaults to i18n value). */
  secondLabel?: string;
  /** Optional extra class names for the root element. */
  className?: string;
  /** Translation function — same signature as the rest of the analysis feature. */
  t: TranslateFn;
}

/**
 * Internal per-slot state.
 */
interface SlotState {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  isDragging: boolean;
  isInvalidDrop: boolean;
}

const createEmptySlot = (): SlotState => ({
  file: null,
  previewUrl: null,
  error: null,
  isDragging: false,
  isInvalidDrop: false,
});

/**
 * MultiImageUploader — side-by-side uploader for the "compare two cups" flow.
 *
 * UX:
 * - Two slots in a responsive grid (1 column mobile, 2 columns desktop).
 * - Each slot supports click-to-pick + drag&drop.
 * - When a slot has a file, preview replaces the drop zone with a "change" button.
 * - The shared "compare" CTA is enabled only when both slots are filled.
 *
 * The component does **not** perform any network I/O — it is consumed by the
 * future `/compare` page which is responsible for invoking the Edge Function.
 */
export const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({
  onImagesReady,
  onClear,
  disabled = false,
  firstLabel,
  secondLabel,
  className,
  t,
}) => {
  const [firstSlot, setFirstSlot] = useState<SlotState>(createEmptySlot);
  const [secondSlot, setSecondSlot] = useState<SlotState>(createEmptySlot);

  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const secondInputRef = useRef<HTMLInputElement | null>(null);

  // Per-slot drag counters — required to reliably distinguish enter/leave events
  // when child elements (preview img, button) re-fire dragenter/dragleave.
  const firstDragCounter = useRef(0);
  const secondDragCounter = useRef(0);

  const setSlot = useCallback(
    (slotId: SlotId, updater: (prev: SlotState) => SlotState) => {
      if (slotId === 'first') {
        setFirstSlot(updater);
      } else {
        setSecondSlot(updater);
      }
    },
    [],
  );

  /**
   * Clean up object URLs whenever the file changes or the component unmounts —
   * `URL.createObjectURL` leaks memory until explicitly revoked.
   */
  useEffect(() => {
    return () => {
      if (firstSlot.previewUrl) URL.revokeObjectURL(firstSlot.previewUrl);
    };
  }, [firstSlot.previewUrl]);

  useEffect(() => {
    return () => {
      if (secondSlot.previewUrl) URL.revokeObjectURL(secondSlot.previewUrl);
    };
  }, [secondSlot.previewUrl]);

  /**
   * Validate a candidate file against mime-type and size constraints.
   * Returns a translated error message on failure, or `null` on success.
   *
   * HEIC/HEIF is rejected with a dedicated message — the Vision backend
   * cannot decode raw HEIC bytes, and we deliberately stopped accepting
   * the type to avoid silent mime mismatches downstream.
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // Detect HEIC/HEIF first so we can show a targeted message even when
      // the browser reports an empty or generic mime type.
      if (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        HEIC_EXTENSION_RE.test(file.name)
      ) {
        return t('multiImageUploader.heicNotSupported');
      }

      const isAllowedMime = (ALLOWED_MIME_TYPES as readonly string[]).includes(
        file.type,
      );

      if (!isAllowedMime) {
        return t('multiImageUploader.invalidType');
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return t('multiImageUploader.tooLarge');
      }
      return null;
    },
    [t],
  );

  const acceptFile = useCallback(
    (slotId: SlotId, file: File) => {
      const errorMessage = validateFile(file);
      if (errorMessage) {
        // Surface via toast (no-op if no <Toaster /> is mounted) AND inline,
        // so the user always sees the reason even without the toast container.
        toast.error(errorMessage);
        setSlot(slotId, (prev) => {
          if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return {
            ...createEmptySlot(),
            error: errorMessage,
          };
        });
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setSlot(slotId, (prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return {
          file,
          previewUrl,
          error: null,
          isDragging: false,
          isInvalidDrop: false,
        };
      });
    },
    [setSlot, validateFile],
  );

  const handleInputChange = useCallback(
    (slotId: SlotId) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) acceptFile(slotId, file);
        // Reset the input so the same file can be re-picked after a clear.
        event.target.value = '';
      },
    [acceptFile],
  );

  const handleDragEnter = useCallback(
    (slotId: SlotId) =>
      (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;

        const counter =
          slotId === 'first' ? firstDragCounter : secondDragCounter;
        counter.current += 1;

        if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
          const isImage = Array.from(event.dataTransfer.items).some(
            (item: DataTransferItem) =>
              item.kind === 'file' && item.type.startsWith('image/'),
          );
          setSlot(slotId, (prev) => ({
            ...prev,
            isDragging: true,
            isInvalidDrop: !isImage,
          }));
        }
      },
    [disabled, setSlot],
  );

  const handleDragLeave = useCallback(
    (slotId: SlotId) =>
      (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;

        const counter =
          slotId === 'first' ? firstDragCounter : secondDragCounter;
        counter.current -= 1;

        if (counter.current <= 0) {
          counter.current = 0;
          setSlot(slotId, (prev) => ({
            ...prev,
            isDragging: false,
            isInvalidDrop: false,
          }));
        }
      },
    [disabled, setSlot],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const handleDrop = useCallback(
    (slotId: SlotId) =>
      (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;

        const counter =
          slotId === 'first' ? firstDragCounter : secondDragCounter;
        counter.current = 0;

        setSlot(slotId, (prev) => ({
          ...prev,
          isDragging: false,
          isInvalidDrop: false,
        }));

        const file = event.dataTransfer.files?.[0];
        if (file) acceptFile(slotId, file);
      },
    [acceptFile, disabled, setSlot],
  );

  const handleChangePhoto = useCallback(
    (slotId: SlotId) => () => {
      if (disabled) return;
      const inputRef = slotId === 'first' ? firstInputRef : secondInputRef;
      inputRef.current?.click();
    },
    [disabled],
  );

  const handleAnalyze = useCallback(() => {
    if (disabled) return;
    if (!firstSlot.file || !secondSlot.file) return;
    onImagesReady(firstSlot.file, secondSlot.file);
  }, [disabled, firstSlot.file, secondSlot.file, onImagesReady]);

  const handleClearAll = useCallback(() => {
    if (disabled) return;
    setFirstSlot((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return createEmptySlot();
    });
    setSecondSlot((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return createEmptySlot();
    });
    firstDragCounter.current = 0;
    secondDragCounter.current = 0;
    onClear?.();
  }, [disabled, onClear]);

  const bothSelected = Boolean(firstSlot.file && secondSlot.file);
  const anySelected = Boolean(firstSlot.file || secondSlot.file);

  const resolvedFirstLabel =
    firstLabel ?? t('multiImageUploader.firstCup');
  const resolvedSecondLabel =
    secondLabel ?? t('multiImageUploader.secondCup');

  return (
    <div className={cn('w-full flex flex-col gap-6', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SlotView
          slotId="first"
          label={resolvedFirstLabel}
          state={firstSlot}
          disabled={disabled}
          inputRef={firstInputRef}
          onInputChange={handleInputChange('first')}
          onDragEnter={handleDragEnter('first')}
          onDragLeave={handleDragLeave('first')}
          onDragOver={handleDragOver}
          onDrop={handleDrop('first')}
          onChange={handleChangePhoto('first')}
          t={t}
        />
        <SlotView
          slotId="second"
          label={resolvedSecondLabel}
          state={secondSlot}
          disabled={disabled}
          inputRef={secondInputRef}
          onInputChange={handleInputChange('second')}
          onDragEnter={handleDragEnter('second')}
          onDragLeave={handleDragLeave('second')}
          onDragOver={handleDragOver}
          onDrop={handleDrop('second')}
          onChange={handleChangePhoto('second')}
          t={t}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end items-stretch sm:items-center">
        {anySelected && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearAll}
            disabled={disabled}
          >
            {t('button.reset')}
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          size="lg"
          onClick={handleAnalyze}
          disabled={disabled || !bothSelected}
        >
          {t('multiImageUploader.compareNow')}
        </Button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                  Slot view                                 */
/* -------------------------------------------------------------------------- */

interface SlotViewProps {
  slotId: SlotId;
  label: string;
  state: SlotState;
  disabled: boolean;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  onChange: () => void;
  t: TranslateFn;
}

const SlotView: React.FC<SlotViewProps> = ({
  slotId,
  label,
  state,
  disabled,
  inputRef,
  onInputChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onChange,
  t,
}) => {
  const inputId = `multi-image-uploader-${slotId}`;
  const hasFile = Boolean(state.file && state.previewUrl);

  const dropZoneClasses = cn(
    'relative w-full aspect-square rounded-lg border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center p-6 bg-muted/50',
    {
      'cursor-pointer hover:border-primary/50 hover:bg-muted group':
        !disabled && !state.isDragging,
      'border-border': !state.isDragging && !state.error,
      'border-primary bg-primary/10 ring-4 ring-primary/20':
        state.isDragging && !state.isInvalidDrop,
      'border-destructive bg-destructive/10 ring-4 ring-destructive/20':
        state.isDragging && state.isInvalidDrop,
      'border-destructive': !state.isDragging && Boolean(state.error),
      'opacity-60 cursor-not-allowed': disabled,
    },
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>

      {hasFile ? (
        <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-border bg-muted">
          <img
            src={state.previewUrl ?? ''}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-background/80 to-transparent">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onChange}
              disabled={disabled}
            >
              {t('multiImageUploader.changePhoto')}
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={dropZoneClasses}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          aria-disabled={disabled}
        >
          <UploadIcon
            className={cn(
              'w-10 h-10 mb-3 transition-all duration-200',
              {
                'text-muted-foreground group-hover:text-primary group-hover:scale-105':
                  !state.isDragging,
                'text-primary scale-110':
                  state.isDragging && !state.isInvalidDrop,
                'text-destructive scale-110':
                  state.isDragging && state.isInvalidDrop,
              },
            )}
          />
          <p
            className={cn('text-sm font-medium text-foreground', {
              'text-destructive':
                state.isDragging && state.isInvalidDrop,
            })}
          >
            {t('multiImageUploader.dropHere')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 pointer-events-none"
            disabled={disabled}
            tabIndex={-1}
          >
            {t('multiImageUploader.uploadButton')}
          </Button>
        </label>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />

      {state.error && !state.isDragging && (
        <p
          className="text-xs text-destructive"
          role="alert"
          aria-live="polite"
        >
          {state.error}
        </p>
      )}
    </div>
  );
};

export default MultiImageUploader;
