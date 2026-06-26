import { create } from 'zustand';

// Client-State der Such-/Filterleisten – Pendant zu frontend/src/store/filterStore.ts.
// Liegt bewusst im Zustand-Store (außerhalb des Komponentenbaums), damit gesetzte
// Filter beim Wechsel zwischen den Tabs (Werkzeuge <-> Werkstätten <-> Profil)
// erhalten bleiben und nicht beim Unmount der Seite zurückgesetzt werden. Bewusst
// keine Persistenz: die Filter sollen nur innerhalb einer Sitzung überleben.

export const DEFAULT_MAX_CAPACITY = 10;

export interface ToolFilters {
  q: string;
  category: string | null;
  borrowFrom: string;
  borrowUntil: string;
  /** Ob das "Erweiterte Filter"-Panel aufgeklappt ist. */
  advancedOpen: boolean;
}

export interface WorkshopFilters {
  q: string;
  borrowFrom: string;
  borrowUntil: string;
  maxCapacity: number;
  /** Ob das "Erweiterte Filter"-Panel aufgeklappt ist. */
  advancedOpen: boolean;
}

const defaultToolFilters: ToolFilters = {
  q: '',
  category: null,
  borrowFrom: '',
  borrowUntil: '',
  advancedOpen: false,
};

const defaultWorkshopFilters: WorkshopFilters = {
  q: '',
  borrowFrom: '',
  borrowUntil: '',
  maxCapacity: DEFAULT_MAX_CAPACITY,
  advancedOpen: false,
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
      toolFilters: { ...defaultToolFilters, advancedOpen: state.toolFilters.advancedOpen },
    })),

  resetWorkshopFilters: () =>
    set((state) => ({
      workshopFilters: {
        ...defaultWorkshopFilters,
        advancedOpen: state.workshopFilters.advancedOpen,
      },
    })),
}));
