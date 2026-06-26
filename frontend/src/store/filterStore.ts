import { create } from "zustand";

// Client-State der Such-/Filterleisten. Liegt bewusst im Zustand-Store (außerhalb
// des Komponentenbaums), damit gesetzte Filter beim Tab-Wechsel (z. B. Werkzeuge ->
// Werkstätten -> Profil) erhalten bleiben und nicht beim Unmount der Seite
// zurückgesetzt werden. Bewusst kein localStorage-Persist: die Filter sollen nur
// innerhalb einer Sitzung überleben, nicht über einen Reload hinaus.

export const DEFAULT_RADIUS_KM = 15;
export const DEFAULT_MAX_CAPACITY = 10;

export interface ToolFilters {
  q: string;
  category: string;
  borrowFrom: string;
  borrowUntil: string;
  radiusKm: number;
  /** Ob das "Erweiterte Filter"-Panel aufgeklappt ist. */
  advancedOpen: boolean;
}

export interface WorkshopFilters {
  q: string;
  toolFilter: string;
  borrowFrom: string;
  borrowUntil: string;
  maxCapacityFilter: number;
  radiusKm: number;
  /** Ob das "Erweiterte Filter"-Panel aufgeklappt ist. */
  advancedOpen: boolean;
}

const defaultToolFilters: ToolFilters = {
  q: "",
  category: "",
  borrowFrom: "",
  borrowUntil: "",
  radiusKm: DEFAULT_RADIUS_KM,
  advancedOpen: false
};

const defaultWorkshopFilters: WorkshopFilters = {
  q: "",
  toolFilter: "",
  borrowFrom: "",
  borrowUntil: "",
  maxCapacityFilter: DEFAULT_MAX_CAPACITY,
  radiusKm: DEFAULT_RADIUS_KM,
  advancedOpen: false
};

interface FilterState {
  toolFilters: ToolFilters;
  workshopFilters: WorkshopFilters;
  setToolFilter: <K extends keyof ToolFilters>(key: K, value: ToolFilters[K]) => void;
  setWorkshopFilter: <K extends keyof WorkshopFilters>(key: K, value: WorkshopFilters[K]) => void;
  resetToolFilters: () => void;
  resetWorkshopFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  toolFilters: defaultToolFilters,
  workshopFilters: defaultWorkshopFilters,

  setToolFilter: (key, value) =>
    set((state) => ({ toolFilters: { ...state.toolFilters, [key]: value } })),

  setWorkshopFilter: (key, value) =>
    set((state) => ({ workshopFilters: { ...state.workshopFilters, [key]: value } })),

  // Beim Zurücksetzen bleibt das aufgeklappte "Erweiterte Filter"-Panel offen –
  // nur die Filterwerte werden geleert.
  resetToolFilters: () =>
    set((state) => ({
      toolFilters: { ...defaultToolFilters, advancedOpen: state.toolFilters.advancedOpen }
    })),

  resetWorkshopFilters: () =>
    set((state) => ({
      workshopFilters: { ...defaultWorkshopFilters, advancedOpen: state.workshopFilters.advancedOpen }
    }))
}));
