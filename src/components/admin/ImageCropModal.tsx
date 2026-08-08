import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImageObj(img);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      img.src = imageSrc;
    } else {
      setImageObj(null);
    }
  }, [imageSrc]);

  useEffect(() => {
    if (!isOpen || !imageObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = 320;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Fill background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Calculate dimensions
    const scale = Math.max(canvasSize / imageObj.width, canvasSize / imageObj.height) * zoom;
    const drawWidth = imageObj.width * scale;
    const drawHeight = imageObj.height * scale;

    const x = (canvasSize - drawWidth) / 2 + pan.x;
    const y = (canvasSize - drawHeight) / 2 + pan.y;

    ctx.drawImage(imageObj, x, y, drawWidth, drawHeight);

    // Draw circular mask overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.rect(0, 0, canvasSize, canvasSize);
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 10, 0, Math.PI * 2, true);
    ctx.fill();

    // Border ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [isOpen, imageObj, zoom, pan]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleCropSave = () => {
    if (!imageObj) return;

    const cropCanvas = document.createElement('canvas');
    const targetSize = 400;
    cropCanvas.width = targetSize;
    cropCanvas.height = targetSize;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.max(targetSize / imageObj.width, targetSize / imageObj.height) * zoom;
    const drawWidth = imageObj.width * scale;
    const drawHeight = imageObj.height * scale;

    const panScaleRatio = targetSize / 320;
    const x = (targetSize - drawWidth) / 2 + (pan.x * panScaleRatio);
    const y = (targetSize - drawHeight) / 2 + (pan.y * panScaleRatio);

    ctx.drawImage(imageObj, x, y, drawWidth, drawHeight);

    const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedDataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
            <Move className="w-5 h-5 text-amber-400" />
            Crop Profile Picture
          </h3>
          <p className="text-xs text-slate-400">
            Drag to position your image and adjust zoom for a perfect profile avatar.
          </p>
        </div>

        {/* Canvas Display */}
        <div className="flex justify-center my-2">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="rounded-3xl border-2 border-amber-500/40 cursor-grab active:cursor-grabbing shadow-inner touch-none"
          />
        </div>

        {/* Zoom & Pan Controls */}
        <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <ZoomIn className="w-4 h-4 text-amber-400" /> Zoom Level
            </span>
            <span className="font-mono text-amber-300">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <ZoomIn className="w-4 h-4 text-amber-400" />
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Reset View
            </button>
            <span className="text-[10px] text-slate-400">Square / Circular Fit</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCropSave}
            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <Check className="w-4 h-4" /> Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
