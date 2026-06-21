import { useEffect, useId, useRef, useState } from "react";

interface ImageUploadProps {
  onImageSelect: (imageData: string | null) => void;
  currentImage?: string;
  placeholderImage: string;
  label: string;
  hint?: string;
}

export function ImageUpload({ onImageSelect, currentImage, placeholderImage, label, hint }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  useEffect(() => {
    setPreview(currentImage || null);
  }, [currentImage]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const applyFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Datei ist zu groß. Maximum 5MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Bitte wähle eine Bilddatei aus (JPG, PNG, etc.).");
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    applyFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      applyFile(file);
    }
  };

  const handleClear = () => {
    setPreview(placeholderImage);
    setFileName("");
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="image-upload">
      <label htmlFor={inputId}>
        <strong>{label}</strong>
      </label>
      {hint && <p id={hintId} className="hint">{hint}</p>}

      <button
        type="button"
        aria-label={`${label}: Bilddatei auswählen`}
        aria-describedby={hint ? hintId : undefined}
        className={`image-preview-container ${isDragging ? "is-dragging" : ""}`.trim()}
        onClick={openFileDialog}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="image-preview" />
            <div className="image-info">
              <p>{fileName || "Standardbild verwendet"}</p>
              <p>Klicken oder Datei hier ablegen, um das Bild zu ersetzen</p>
            </div>
          </>
        ) : (
          <div className="image-placeholder">
            <span className="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 15V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8.5 8.5 12 5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 14.5v2.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="upload-copy">
              <span className="upload-title">Bilddatei hochladen</span>
              <span className="upload-description">Ziehe dein Werkzeugfoto hierher oder klicke zum Auswählen.</span>
            </span>
            <span className="upload-meta">JPG, PNG, WebP · max. 5 MB</span>
          </div>
        )}
      </button>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <div className="button-group">
        <button
          type="button"
          aria-describedby={hint ? hintId : undefined}
          onClick={openFileDialog}
          className="btn btn-secondary"
        >
          {preview ? "Bild wechseln" : "Bild hochladen"}
        </button>
        {fileName && (
          <button type="button" onClick={handleClear} className="btn btn-outline">
            Entfernen
          </button>
        )}
      </div>
    </div>
  );
}
