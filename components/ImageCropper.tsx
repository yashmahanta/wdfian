import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from '../limits';

interface ImageCropperProps {
  file: File;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
}

interface Selection {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';
const corners = ['nw', 'ne', 'sw', 'se'] as const;
const fullImage = { left: 0, top: 0, right: 1, bottom: 1 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

async function encodeCrop(image: HTMLImageElement, crop: Selection): Promise<string> {
  const x = Math.floor(crop.left * image.naturalWidth);
  const y = Math.floor(crop.top * image.naturalHeight);
  const w = Math.max(1, Math.ceil(crop.right * image.naturalWidth) - x);
  const h = Math.max(1, Math.ceil(crop.bottom * image.naturalHeight) - y);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser could not prepare the crop.');

  let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
  for (const quality of [0.9, 0.78, 0.72, 0.68]) {
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));
    if (canvas.width !== width || canvas.height !== height || quality === 0.9) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, x, y, w, h, 0, 0, width, height);
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('This browser could not prepare the crop.');
    if (blob.size <= MAX_IMAGE_BYTES) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('This browser could not read the crop.'));
        reader.readAsDataURL(blob);
      });
    }
    if (quality < 0.9) scale *= Math.min(0.85, Math.sqrt(MAX_IMAGE_BYTES / blob.size) * 0.95);
  }

  throw new Error('This crop is too large. Select a smaller area and try again.');
}

export default function ImageCropper({ file, onCropComplete, onCancel }: ImageCropperProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRequest = useRef(0);
  const selectionRef = useRef(fullImage);
  const drag = useRef<{ pointerId: number; handle: Handle; x: number; y: number; selection: Selection } | null>(null);
  const [source, setSource] = useState('');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState(fullImage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = viewportRef.current;
    if (!dialog || !viewport) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(0, width - 36), height: Math.max(0, height - 36) });
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRequest.current);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const scale = natural.width ? Math.min(size.width / natural.width, size.height / natural.height, 2) : 0;
  const width = natural.width * scale;
  const height = natural.height * scale;

  function startDrag(event: PointerEvent<HTMLElement>, handle: Handle) {
    if (!event.isPrimary || event.button !== 0 || saving) return;
    event.stopPropagation();
    frameRef.current?.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, handle, x: event.clientX, y: event.clientY, selection: selectionRef.current };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || !width || !height) return;
    const dx = (event.clientX - active.x) / width;
    const dy = (event.clientY - active.y) / height;
    const { left, top, right, bottom } = active.selection;
    const minW = Math.min(0.5, 32 / width);
    const minH = Math.min(0.5, 32 / height);
    const next = { ...active.selection };

    if (active.handle === 'move') {
      const moveX = clamp(dx, -left, 1 - right);
      const moveY = clamp(dy, -top, 1 - bottom);
      next.left += moveX;
      next.right += moveX;
      next.top += moveY;
      next.bottom += moveY;
    } else {
      if (active.handle.includes('w')) next.left = clamp(left + dx, 0, right - minW);
      if (active.handle.includes('e')) next.right = clamp(right + dx, left + minW, 1);
      if (active.handle.includes('n')) next.top = clamp(top + dy, 0, bottom - minH);
      if (active.handle.includes('s')) next.bottom = clamp(bottom + dy, top + minH, 1);
    }

    selectionRef.current = next;
    if (!frameRequest.current) {
      frameRequest.current = requestAnimationFrame(() => {
        frameRequest.current = 0;
        setSelection(selectionRef.current);
      });
    }
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === drag.current?.pointerId) drag.current = null;
  }

  async function applyCrop() {
    const image = imageRef.current;
    if (!image?.naturalWidth || saving) return;
    setSaving(true);
    setError('');
    try {
      onCropComplete(await encodeCrop(image, selectionRef.current));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not prepare this crop.');
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="crop-title"
      onCancel={event => { event.preventDefault(); onCancel(); }}
      className="crop-dialog fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/95"
    >
      <div className="flex h-full items-center justify-center md:p-4">
        <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl md:h-[min(45rem,90dvh)] md:rounded-3xl">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <h3 id="crop-title" className="text-xs font-black uppercase tracking-widest text-slate-800">Crop Image</h3>
              <p className="text-xs text-slate-500">Drag the corners to keep the full question.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className="min-h-11 px-3 text-xs font-bold text-slate-600">Cancel</button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={!width || saving}
                className="min-h-11 rounded-xl bg-amber-500 px-4 text-xs font-black uppercase tracking-wide text-slate-950 shadow-sm disabled:opacity-50"
              >
                {saving ? 'Preparing…' : 'Apply Crop'}
              </button>
            </div>
          </div>

          <div ref={viewportRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-200">
            {source && (
              <div
                ref={frameRef}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                className="relative shrink-0 touch-none select-none"
                style={{ width, height }}
              >
                <img
                  ref={imageRef}
                  src={source}
                  alt="Question photo"
                  draggable={false}
                  onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                  onError={() => setError('This image could not be opened. Try a JPG, PNG, or a screenshot.')}
                  className="block h-full w-full max-w-none object-fill"
                />
                {!!width && (
                  <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                    <div className="absolute inset-0 border border-slate-400/50" />
                    <div
                      onPointerDown={event => startDrag(event, 'move')}
                      className="absolute cursor-move border-2 border-amber-500 shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]"
                      style={{
                        left: `${selection.left * 100}%`, top: `${selection.top * 100}%`,
                        right: `${(1 - selection.right) * 100}%`, bottom: `${(1 - selection.bottom) * 100}%`,
                      }}
                    />
                  </div>
                )}
                {!!width && corners.map(corner => (
                  <div
                    key={corner}
                    aria-hidden="true"
                    onPointerDown={event => startDrag(event, corner)}
                    className={`absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center ${corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`}
                    style={{
                      left: `${(corner.includes('w') ? selection.left : selection.right) * 100}%`,
                      top: `${(corner.includes('n') ? selection.top : selection.bottom) * 100}%`,
                    }}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow-sm" />
                  </div>
                ))}
              </div>
            )}
            {!width && <p role={error ? 'alert' : 'status'} className="absolute p-4 text-center text-sm text-slate-700">{error || 'Opening image…'}</p>}
          </div>

          <div className="flex min-h-12 shrink-0 items-center justify-center border-t border-slate-100 bg-slate-50 px-4 text-center text-xs text-slate-600">
            {error && width ? <p role="alert" className="text-red-700">{error}</p> : <p>Drag the center to move the crop.</p>}
          </div>
        </div>
      </div>
    </dialog>
  );
}
