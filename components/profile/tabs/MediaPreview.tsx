'use client';

interface Props {
  url: string;
  type: 'photo' | 'video';
  description?: string;
  filename?: string;
  onClose: () => void;
}

export default function MediaPreview({ url, type, description, filename, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[2400] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full max-h-[90vh] bg-black rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {type === 'photo' ? (
          <img
            src={url}
            alt={description || filename || 'Media'}
            className="w-full h-auto max-h-[80vh] object-contain"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="w-full h-auto max-h-[80vh]"
          />
        )}
        <div className="p-4 text-white">
          <p>{description || filename || 'Tanpa deskripsi'}</p>
          <button
            type="button"
            className="mt-2 px-4 py-2 bg-red-500 rounded hover:bg-red-600 transition"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}