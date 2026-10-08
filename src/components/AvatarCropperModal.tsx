import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  User,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { normalizeImageFile } from '../services/imageUtils';

interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
  imageFile: File | null;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  onClose,
  onApply,
  imageFile,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load, convert HEIC, and downsample large / high-res images safely
  useEffect(() => {
    if (!isOpen || !imageFile) {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
      setImageSrc(null);
      imgRef.current = null;
      setPreviewDataUrl(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    let active = true;
    let currentBlobUrl: string | null = null;

    (async () => {
      try {
        const processedFile = await normalizeImageFile(imageFile);
        if (!active) return;

        currentBlobUrl = URL.createObjectURL(processedFile);
        const blobUrl = currentBlobUrl;

        const img = new Image();
        img.onload = () => {
          if (!active) {
            URL.revokeObjectURL(blobUrl);
            return;
          }

          // If image is gigantic (e.g. 48MP or 4000px+), downscale to max 1600px for buttery smooth canvas performance
          const maxDim = 1600;
          let targetW = img.naturalWidth;
          let targetH = img.naturalHeight;

          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }

            const downCanvas = document.createElement('canvas');
            downCanvas.width = targetW;
            downCanvas.height = targetH;
            const downCtx = downCanvas.getContext('2d');
            if (downCtx) {
              downCtx.drawImage(img, 0, 0, targetW, targetH);
              const downsampledUrl = downCanvas.toDataURL('image/jpeg', 0.92);
              const downImg = new Image();
              downImg.onload = () => {
                if (!active) return;
                imgRef.current = downImg;
                setImageSrc(downsampledUrl);
                setZoom(1);
                setPan({ x: 0, y: 0 });
                updatePreview(downImg, 1, { x: 0, y: 0 });
                setIsLoading(false);
              };
              downImg.src = downsampledUrl;
              URL.revokeObjectURL(blobUrl);
              return;
            }
          }

          imgRef.current = img;
          setImageSrc(blobUrl);
          setZoom(1);
          setPan({ x: 0, y: 0 });
          updatePreview(img, 1, { x: 0, y: 0 });
          setIsLoading(false);
        };

        img.onerror = () => {
          if (!active) return;
          setIsLoading(false);
          setLoadError('Could not decode image format. Please try another photo.');
          console.warn('Failed to decode image');
        };

        img.src = blobUrl;
      } catch (err: any) {
        if (!active) return;
        setIsLoading(false);
        setLoadError('Failed to process image: ' + (err?.message || 'unknown error'));
      }
    })();

    return () => {
      active = false;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [isOpen, imageFile]);

  const updatePreview = useCallback(
    (img: HTMLImageElement, currentZoom: number, currentPan: { x: number; y: number }) => {
      if (!img) return;
      // Output target: 256x256 compact profile picture
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill neutral dark background
      ctx.fillStyle = '#141418';
      ctx.fillRect(0, 0, size, size);

      // Draw image centered with zoom & pan
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight) * currentZoom;
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = (size - drawW) / 2 + currentPan.x * (size / 200);
      const drawY = (size - drawH) / 2 + currentPan.y * (size / 200);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      // High quality, low-footprint JPEG (typically ~15KB - 25KB)
      setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.85));
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !imgRef.current) return;
    const newPan = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    };
    setPan(newPan);
    updatePreview(imgRef.current, zoom, newPan);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.7, Math.min(3.5, newZoom));
    setZoom(clamped);
    if (imgRef.current) {
      updatePreview(imgRef.current, clamped, pan);
    }
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (imgRef.current) {
      updatePreview(imgRef.current, 1, { x: 0, y: 0 });
    }
  };

  const handleApply = () => {
    if (!imgRef.current) return;
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, size, size);

    const scale = Math.max(size / imgRef.current.naturalWidth, size / imgRef.current.naturalHeight) * zoom;
    const drawW = imgRef.current.naturalWidth * scale;
    const drawH = imgRef.current.naturalHeight * scale;
    const drawX = (size - drawW) / 2 + pan.x * (size / 200);
    const drawY = (size - drawH) / 2 + pan.y * (size / 200);

    ctx.drawImage(imgRef.current, drawX, drawY, drawW, drawH);
    // Export low size, compressed JPEG for instant sync to Cloudflare & localStorage (<15KB)
    const compactDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    onApply(compactDataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#16161a] border border-white/15 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-black text-base text-white">Crop Profile Picture</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-white/60 -mt-1">
          Drag to center your photo within the circle. Pinch or use the slider to zoom.
        </p>

        {/* Viewport Box with Circular Mask */}
        <div className="relative w-full aspect-square max-w-[240px] mx-auto rounded-2xl bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center select-none touch-none">
          {imageSrc ? (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full cursor-grab active:cursor-grabbing relative flex items-center justify-center overflow-hidden"
            >
              {/* Scaled & panned image */}
              <img
                src={imageSrc}
                alt="Crop subject"
                draggable={false}
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: 'center center',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
                className="select-none pointer-events-none transition-transform duration-75"
              />

              {/* iOS Avatar Circular Cutout Mask */}
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                }}
              />
              <div className="absolute w-[190px] h-[190px] rounded-full border-2 border-[var(--accent)] shadow-[0_0_15px_rgba(255,107,26,0.5)] pointer-events-none" />
            </div>
          ) : (
            <div className="text-white/60 text-xs flex flex-col items-center gap-2 p-4 text-center">
              {loadError ? (
                <>
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <span className="text-red-400 max-w-[220px]">{loadError}</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                  <span>Converting & preparing photo...</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Zoom Slider */}
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center justify-between text-xs text-white/60 font-semibold">
            <span className="flex items-center gap-1">
              <ZoomOut className="w-3.5 h-3.5" /> Zoom
            </span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.7"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="flex-1 custom-slider"
            />
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!imageSrc || isLoading}
            className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-[var(--accent)]/20 cursor-pointer disabled:opacity-40"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
};
