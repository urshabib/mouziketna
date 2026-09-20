import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';

interface LogoCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
  currentLogoSrc?: string;
}

export const LogoCropperModal: React.FC<LogoCropperModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentLogoSrc,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset state when opening or closing
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setPreviewDataUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      // Clear loaded image and transient state on close
      setImageSrc(null);
      imgRef.current = null;
      setPreviewDataUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setImageSrc(src);
      setZoom(1);
      setPan({ x: 0, y: 0 });

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        updatePreview(img, 1, { x: 0, y: 0 });
      };
      img.onerror = () => {
        console.warn('Failed to load image for cropping');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    // Reset the input value so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const updatePreview = useCallback(
    (img: HTMLImageElement, currentZoom: number, currentPan: { x: number; y: number }) => {
      if (!img) return;
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear & fill background
      ctx.fillStyle = '#0e0a06';
      ctx.fillRect(0, 0, size, size);

      // Draw image centered with zoom & pan
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight) * currentZoom;
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = (size - drawW) / 2 + currentPan.x * 2;
      const drawY = (size - drawH) / 2 + currentPan.y * 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      setPreviewDataUrl(canvas.toDataURL('image/png'));
    },
    []
  );

  // Mouse / Touch Drag handlers for panning
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
    const clamped = Math.max(0.8, Math.min(3.5, newZoom));
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

  const handleSaveLogo = () => {
    if (!imgRef.current) return;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0e0a06';
    ctx.fillRect(0, 0, size, size);

    const scale = Math.max(size / imgRef.current.naturalWidth, size / imgRef.current.naturalHeight) * zoom;
    const drawW = imgRef.current.naturalWidth * scale;
    const drawH = imgRef.current.naturalHeight * scale;
    const drawX = (size - drawW) / 2 + pan.x * 2;
    const drawY = (size - drawH) / 2 + pan.y * 2;

    ctx.drawImage(imgRef.current, drawX, drawY, drawW, drawH);
    const finalDataUrl = canvas.toDataURL('image/png');
    onApply(finalDataUrl);
    onClose();
  };

  if (!isOpen) return null;

  const modalMarkup = (
    <div
      id="logo-cropper-modal-backdrop"
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        id="logo-cropper-modal-container"
        className="w-full sm:max-w-lg bg-[#161619] border-t sm:border border-white/10 rounded-t-[2rem] sm:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col gap-4 text-white max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe handle */}
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff6b1a]/20 flex items-center justify-center text-[#ff6b1a]">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Upload & Crop App Logo
              </h3>
              <p className="text-[11px] text-white/50">
                Choose an image from your gallery and frame it for your app icon
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Cropper Area */}
        {imageSrc ? (
          <div className="flex flex-col gap-4">
            {/* Viewport Canvas with Mask Overlay */}
            <div className="relative w-full aspect-square max-w-[320px] mx-auto bg-black rounded-3xl overflow-hidden border-2 border-white/15 shadow-inner cursor-grab active:cursor-grabbing flex items-center justify-center touch-none select-none">
              {/* Image being dragged/panned/zoomed */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-full flex items-center justify-center relative overflow-hidden"
              >
                <img
                  src={imageSrc}
                  alt="Crop Target"
                  draggable={false}
                  className="max-w-none pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>

              {/* Squircle App-Icon Crop Mask Overlay */}
              <div className="absolute inset-0 pointer-events-none border-[24px] border-black/60 rounded-3xl flex items-center justify-center">
                <div className="w-full h-full rounded-[28px] border-2 border-[#ff6b1a]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative">
                  {/* Subtle Grid crosshairs */}
                  <div className="absolute inset-x-0 top-1/3 border-b border-white/15" />
                  <div className="absolute inset-x-0 top-2/3 border-b border-white/15" />
                  <div className="absolute inset-y-0 left-1/3 border-r border-white/15" />
                  <div className="absolute inset-y-0 left-2/3 border-r border-white/15" />
                </div>
              </div>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-semibold text-white/70 border border-white/10 pointer-events-none">
                Drag to reposition • Scroll to zoom
              </div>
            </div>

            {/* Controls: Zoom Scrubber Slider */}
            <div className="flex flex-col gap-2 bg-white/[0.03] p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between text-xs font-bold text-white/80">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <span>Crop & Zoom Scale</span>
                </span>
                <span className="text-[#ff6b1a]">{Math.round(zoom * 100)}%</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom - 0.2)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <input
                  type="range"
                  min="0.8"
                  max="3.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-[#ff6b1a] h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom + 0.2)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Reset Position"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live App Icon Preview */}
            {previewDataUrl && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border border-white/15 flex-shrink-0 bg-black">
                    <img
                      src={previewDataUrl}
                      alt="Icon Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ff6b1a]" />
                      <span>Live Icon Preview</span>
                    </div>
                    <p className="text-[11px] text-white/50">
                      Framed at 512x512 ready for installation
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 hover:text-white border border-white/10 transition-colors"
                >
                  Change Photo
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLogo}
                className="flex-1 py-3 px-4 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-[0.98] text-xs font-black text-black flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b1a]/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply as App Logo</span>
              </button>
            </div>
          </div>
        ) : (
          /* File Upload Selector */
          <div className="flex flex-col gap-4 py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 hover:border-[#ff6b1a] rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white/[0.02] hover:bg-[#ff6b1a]/5 transition-all text-center group"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 group-hover:bg-[#ff6b1a]/20 flex items-center justify-center text-white/60 group-hover:text-[#ff6b1a] transition-all shadow-md">
                <Upload className="w-8 h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-sm text-white">
                  Choose Photo from Gallery / Device
                </span>
                <span className="text-xs text-white/50">
                  Select any PNG, JPG, or WebP picture to crop into your custom logo
                </span>
              </div>
            </div>

            {currentLogoSrc && (
              <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-2xl">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10 flex-shrink-0">
                  <img
                    src={currentLogoSrc}
                    alt="Current Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-white block">Current Logo Active</span>
                  <span className="text-[11px] text-white/50">
                    Upload a new photo above to replace it
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalMarkup, document.body)
    : modalMarkup;
};
