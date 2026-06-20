import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import {
  EMPTY_ADDRESS,
  isAddressComplete,
  parseAddress,
  toAddressPayload,
  type AddressFormFields
} from "../utils/address";
import { CategorySelect } from "../components/CategorySelect";
import { ImageUpload } from "../components/ImageUpload";
import { Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import {  api  } from "@toolshare/shared";
import {  DEFAULT_PLACEHOLDER_IMAGE  } from "@toolshare/shared";
import type {  User  } from "@toolshare/shared";

type Props = {
  currentUser?: User;
  token?: string;
};

export function EditToolPage({ currentUser, token }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState({ ...EMPTY_ADDRESS });
  const [originalPickupAddress, setOriginalPickupAddress] = useState<AddressFormFields | null>(null);
  const [originalPickupLocation, setOriginalPickupLocation] = useState("");
  const [addressSearchValue, setAddressSearchValue] = useState("");
  const [pickupLocationNote, setPickupLocationNote] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!id || !token || !currentUser) {
        setLoading(false);
        return;
      }
      try {
        const tools = await api.getTools({ ownerId: currentUser.id }, token);
        const tool = tools.find((entry) => entry.id === id);
        if (!tool || tool.ownerId !== currentUser.id) {
          pushToast("Dieses Werkzeug kann nur vom Anbieter bearbeitet werden.", "error");
          navigate("/offers");
          return;
        }
        setName(tool.name);
        setDescription(tool.description);
        setCategory(tool.category);
        setImageUrl(tool.imageUrl || null);
        const parsedPickupAddress = parseAddress(tool.pickupLocation);
        setAddressSearchValue(tool.pickupLocation ?? "");
        setPickupAddress(parsedPickupAddress);
        setOriginalPickupAddress(parsedPickupAddress);
        setOriginalPickupLocation(tool.pickupLocation ?? "");
        setPickupLocationNote(tool.pickupLocationNote ?? "");
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht geladen werden.", "error");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUser, id, navigate, pushToast, token]);

  if (!token) {
    return (
      <section className="stack">
        <h1>Werkzeug bearbeiten</h1>
        <Surface title="Login erforderlich">
          <Link to="/auth" className="btn">Einloggen</Link>
        </Surface>
      </section>
    );
  }

  if (loading) {
    return <section className="stack"><h1>Werkzeug bearbeiten</h1><p>Laden...</p></section>;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || saving) return;
    const addressWasChanged =
      !originalPickupAddress ||
      Object.keys(pickupAddress).some(
        (key) =>
          pickupAddress[key as keyof AddressFormFields] !==
          originalPickupAddress[key as keyof AddressFormFields]
      );
    const hasValidPickupLocation =
      isAddressComplete(pickupAddress) ||
      (!addressWasChanged && originalPickupLocation.trim().length >= 5);

    if (!name.trim() || description.trim().length < 5 || !category || !hasValidPickupLocation) {
      return;
    }

    setSaving(true);
    try {
      const address = addressWasChanged
        ? toAddressPayload(pickupAddress)
        : originalPickupLocation;
      const validation = addressWasChanged
        ? await api.validateAddress(address)
        : { isValid: true, normalizedAddress: originalPickupLocation };
      if (!validation.isValid) {
        pushToast("Adresse konnte nicht verifiziert werden.", "error");
        return;
      }
      await api.updateTool(
        id,
        {
          name: name.trim(),
          description: description.trim(),
          category,
          imageUrl: imageUrl || DEFAULT_PLACEHOLDER_IMAGE,
          pickupLocation: validation.normalizedAddress?.trim() || address,
          pickupLocationNote: pickupLocationNote.trim() || undefined
        },
        token
      );
      pushToast("Werkzeug aktualisiert.", "success");
      navigate(`/tools/${id}?manage=1`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht aktualisiert werden.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="new-tool-page">
      <h1>Werkzeug bearbeiten</h1>
      <form className="new-tool-form" onSubmit={onSubmit} noValidate>
        <p className="required-note">Pflichtfelder werden mit einem * markiert!</p>
        <ImageUpload
          onImageSelect={setImageUrl}
          currentImage={imageUrl ?? undefined}
          placeholderImage={DEFAULT_PLACEHOLDER_IMAGE}
          label="Werkzeug Fotos"
          hint="Tausche das Foto deines Werkzeugs aus."
        />
        <label className="tool-form-field">
          <span>Name *</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
        </label>
        <label className="tool-form-field">
          <span className="field-label-row">
            <span>Beschreibung *</span>
            <span className="char-count">{description.length}/1000 Zeichen</span>
          </span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={1000} />
        </label>
        <CategorySelect value={category} onChange={setCategory} label="Kategorie *" />
        <div className="tool-form-field new-tool-address-section">
          <span>Abholort *</span>
          <AddressInput
            value={pickupAddress}
            onChange={setPickupAddress}
            initialSearchValue={addressSearchValue}
            required
          />
        </div>
        <label className="tool-form-field">
          <span>Hinweis zur Abholung</span>
          <textarea
            value={pickupLocationNote}
            onChange={(event) => setPickupLocationNote(event.target.value)}
            rows={3}
            maxLength={300}
          />
        </label>
        <div className="new-tool-actions">
          <button type="submit" disabled={saving}>{saving ? "Wird gespeichert..." : "Änderungen speichern"}</button>
          <Link to={`/tools/${id}?manage=1`} className="btn btn-outline">Abbrechen</Link>
        </div>
      </form>
    </section>
  );
}
