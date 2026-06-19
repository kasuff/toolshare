import { useId, useRef, useState } from "react";

interface WorkshopPhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  label: string;
  hint?: string;
  maxPhotos?: number;
  describedBy?: string;
}

export function WorkshopPhotoUpload({ photos, onPhotosChange, label, hint, maxPhotos = 3, describedBy }: WorkshopPhotoUploadProps) {
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const internalErrorId = `${inputId}-error`;
  const descriptionIds = [describedBy, error ? internalErrorId : null].filter(Boolean).join(" ") || undefined;

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setError("");

    const newPhotos = [...photos];
    for (const file of files) {
      if (newPhotos.length >= maxPhotos) {
        setError(`Maximal ${maxPhotos} Fotos erlaubt`);
        break;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("Datei ist zu groß. Maximum 5MB pro Foto.");
        continue;
      }

      if (!file.type.startsWith("image/")) {
        setError("Bitte wähle nur Bilddateien aus (JPG, PNG, etc.)");
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        newPhotos.push(imageData);
        onPhotosChange(newPhotos);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="photo-upload">
      <strong>{label}</strong>
      {hint && <p className="hint">{hint}</p>}

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={openFileDialog}
          className="image-preview-container workshop-empty-photo-upload"
          aria-describedby={descriptionIds}
        >
          <div className="image-placeholder">
            <span className="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 15V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8.5 8.5 12 5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 14.5v2.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="upload-copy">
              <span className="upload-title">Bilddateien hochladen</span>
              <span className="upload-description">Ziehe deine Werkstattfotos hierher oder klicke zum Auswählen.</span>
            </span>
            <span className="upload-meta">JPG, PNG, WebP · max. 5 MB</span>
          </div>
        </button>
      ) : (
      <div className="photo-grid">
        {photos.map((photo, index) => (
          <div key={index} className="photo-item">
            <img src={photo} alt={`Foto ${index + 1}`} className="photo-preview" />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="photo-remove"
              title="Foto entfernen"
              aria-label={`Foto ${index + 1} entfernen`}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            {index === 0 && <div className="photo-label">Hauptfoto</div>}
          </div>
        ))}

        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={openFileDialog}
            className="photo-upload-button"
            aria-describedby={descriptionIds}
          >
            <div className="photo-placeholder">
              <span className="upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M8.5 8.5 12 5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 14.5v2.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="upload-copy">
                <span className="upload-title">Werkstattfotos hochladen</span>
                <span className="upload-description">Wähle bis zu {maxPhotos} Bilder deiner Werkstatt aus.</span>
              </span>
              <span className="upload-meta">JPG, PNG, WebP · max. 5 MB</span>
            </div>
          </button>
        )}
      </div>
      )}

      {error && <p id={internalErrorId} className="field-error" role="alert">{error}</p>}
      <p className="meta-text">{photos.length} von {maxPhotos} Fotos</p>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}
