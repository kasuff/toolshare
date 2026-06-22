import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { api } from "@toolshare/shared";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@toolshare/shared";
import type { User } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function EditToolPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState({ ...EMPTY_ADDRESS });
  const [originalPickupAddress, setOriginalPickupAddress] = useState<AddressFormFields | null>(null);
  const [originalPickupLocation, setOriginalPickupLocation] = useState("");
  const [addressSearchValue, setAddressSearchValue] = useState("");
  const [pickupLocationNote, setPickupLocationNote] = useState("");

  const { data: tool, isLoading, isError, error } = useQuery({
    queryKey: ["tool", id, "edit", token],
    queryFn: async () => {
      if (!id || !token || !currentUser) throw new Error("Missing auth/id");
      const tools = await api.getTools({ ownerId: currentUser.id }, token);
      const foundTool = tools.find((entry) => entry.id === id);
      if (!foundTool || foundTool.ownerId !== currentUser.id) {
        throw new Error("Dieses Werkzeug kann nur vom Anbieter bearbeitet werden.");
      }
      return foundTool;
    },
    enabled: !!id && !!token && !!currentUser,
    retry: false
  });

  useEffect(() => {
    if (tool) {
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
    }
  }, [tool]);

  useEffect(() => {
    if (isError) {
      pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht geladen werden.", "error");
      navigate("/offers");
    }
  }, [isError, error, navigate, pushToast]);

  const { mutate: updateToolMut, isPending: saving } = useMutation({
    mutationFn: async ({ address, addressWasChanged }: { address: string; addressWasChanged: boolean }) => {
      if (!id || !token) throw new Error("Missing context");
      const validation = addressWasChanged
        ? await api.validateAddress(address)
        : { isValid: true, normalizedAddress: originalPickupLocation };
      if (!validation.isValid) {
        throw new Error("Adresse konnte nicht verifiziert werden.");
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool", id] });
      pushToast("Werkzeug aktualisiert.", "success");
      navigate(`/tools/${id}?manage=1`);
    },
    onError: (e) => {
      pushToast(e instanceof Error ? e.message : "Werkzeug konnte nicht aktualisiert werden.", "error");
    }
  });

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

  if (isLoading || !tool) {
    return <section className="stack"><h1>Werkzeug bearbeiten</h1><p>Laden...</p></section>;
  }

  const onSubmit = (event: FormEvent) => {
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

    const address = addressWasChanged
      ? toAddressPayload(pickupAddress)
      : originalPickupLocation;

    updateToolMut({ address, addressWasChanged });
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
        <div className="tool-form-field">
          <span className="field-label-row">
            <span>Beschreibung *</span>
            <span className="char-count">{description.length}/1000 Zeichen</span>
          </span>
          <textarea aria-label="Beschreibung" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={1000} />
        </div>
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
