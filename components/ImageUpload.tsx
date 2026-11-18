
import React, { useRef } from 'react';
import { MAX_IMAGES } from '../limits';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  onRemoveImage: (index: number) => void;
  onClearAll: () => void;
  images: string[];
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, onRemoveImage, onClearAll, images, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && !disabled) onImageSelect(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="block text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Question Images ({images.length})
        </h3>
        {images.length > 0 && (
          <button 
            onClick={onClearAll}
            disabled={disabled}
            className="min-h-11 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 disabled:opacity-50"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-white aspect-video flex items-center justify-center">
            <img src={img} alt={`Question image ${idx + 1}`} decoding="async" className="max-w-full max-h-full object-contain" />
            <div className="absolute top-1 right-1">
              <button 
                type="button"
                onClick={() => onRemoveImage(idx)}
                disabled={disabled}
                aria-label={`Remove image ${idx + 1}`}
                className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950/80 text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                title="Remove image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div className="absolute bottom-1 right-1 bg-slate-900/80 text-[8px] text-white px-1.5 py-0.5 rounded font-black">
              #{idx + 1}
            </div>
          </div>
        ))}
        
        {images.length < MAX_IMAGES && (
          <div className="flex min-h-24 flex-col overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-1 flex-col items-center justify-center px-2 py-2 
                min-h-11 transition-colors duration-200
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-50'}
              `}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Add Image</span>
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled}
              className="min-h-11 border-t border-slate-200 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-amber-50 disabled:opacity-50 md:hidden"
            >
              Take Photo
            </button>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
        disabled={disabled}
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};

export default ImageUpload;
