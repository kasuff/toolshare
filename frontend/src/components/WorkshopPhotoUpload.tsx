import { useRef, useState } from "react";

interface WorkshopPhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  label: string;
  hint?: string;
  maxPhotos?: number;
}

export function WorkshopPhotoUpload({ photos, onPhotosChange, label, hint, maxPhotos = 3 }: WorkshopPhotoUploadProps) {
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <label>
        <strong>{label}</strong>
      </label>
      {hint && <p className="hint">{hint}</p>}

      <div className="photo-grid">
        {photos.map((photo, index) => (
          <div key={index} className="photo-item">
            <img src={photo} alt={`Foto ${index + 1}`} className="photo-preview" />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="photo-remove"
              title="Foto entfernen"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            {index === 0 && <div className="photo-label">Hauptfoto</div>}
          </div>
        ))}

        {photos.length < maxPhotos && (
          <button type="button" onClick={openFileDialog} className="photo-upload-button">
            <div className="photo-placeholder">
              <span className="material-symbols-outlined placeholder-icon">add_a_photo</span>
              <span className="placeholder-text">Foto hinzufügen</span>
            </div>
          </button>
        )}
      </div>

      {error && <p className="field-error">{error}</p>}
      <p className="meta-text">{photos.length} von {maxPhotos} Fotos</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}
