import { useState, useRef } from "react";

interface ImageUploadProps {
  onImageSelect: (imageData: string | null) => void;
  currentImage?: string;
  label: string;
  hint?: string;
}

export function ImageUpload({ onImageSelect, currentImage, label, hint }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("Datei ist zu groß. Maximum 5MB.");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Bitte wähle eine Bilddatei aus (JPG, PNG, etc.)");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setPreview(imageData);
      onImageSelect(imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setPreview(null);
    setFileName("");
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="image-upload">
      <label htmlFor="image-input">
        <strong>{label}</strong>
      </label>
      {hint && <p className="hint">{hint}</p>}

      <button type="button" className="image-preview-container" onClick={openFileDialog}>
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="image-preview" />
            <div className="image-info">
              <p>{fileName || "Bild ausgewählt"}</p>
              <p>Klicken zum Ersetzen</p>
            </div>
          </>
        ) : (
          <div className="image-placeholder">
            <p>Klick zum Bild hochladen</p>
            <p>JPG, PNG, max. 5 MB</p>
          </div>
        )}
      </button>

      <input
        ref={fileInputRef}
        id="image-input"
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <div className="button-group">
        <button
          type="button"
          onClick={openFileDialog}
          className="btn btn-secondary"
        >
          {preview ? "Bild wechseln" : "Bild hochladen"}
        </button>
        {preview && (
          <button type="button" onClick={handleClear} className="btn btn-outline">
            Entfernen
          </button>
        )}
      </div>
    </div>
  );
}
