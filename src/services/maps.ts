import firebaseConfig from "../../firebase-applet-config.json";

// Resolve the Google Maps Platform API key
export const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (firebaseConfig as any).apiKey ||
  "";

// Mandatory usage attribution ID for this AI Studio environment
export const MAPS_INTERNAL_ATTRIBUTION_ID = "gmp_mcp_codeassist_v1_aistudio";

export interface PlaceMarker {
  id: string;
  name: string;
  category: "library" | "study" | "cafe" | "hospital" | "campus";
  position: { lat: number; lng: number };
  address: string;
  rating?: number;
  openNow?: boolean;
  mapsUrl: string;
}

// Default initial location: San Francisco / Silicon Valley tech hub (or current user coordinates)
export const DEFAULT_MAP_CENTER = {
  lat: 37.7749,
  lng: -122.4194,
};

// Curated default academic / study / library points of interest for demonstration and quick search
export const SAMPLE_STUDY_PLACES: PlaceMarker[] = [
  {
    id: "place-1",
    name: "Main Public Library & Reading Atrium",
    category: "library",
    position: { lat: 37.7792, lng: -122.416 },
    address: "100 Larkin St, San Francisco, CA 94102",
    rating: 4.8,
    openNow: true,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=San+Francisco+Public+Library",
  },
  {
    id: "place-2",
    name: "Quiet Study Hub & Learning Commons",
    category: "study",
    position: { lat: 37.7845, lng: -122.408 },
    address: "835 Market St, San Francisco, CA 94103",
    rating: 4.7,
    openNow: true,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Quiet+Study+Hub+San+Francisco",
  },
  {
    id: "place-3",
    name: "Artisan Coffee & Work Lounge",
    category: "cafe",
    position: { lat: 37.7715, lng: -122.424 },
    address: "375 Valencia St, San Francisco, CA 94103",
    rating: 4.6,
    openNow: true,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Artisan+Coffee+Valencia+St",
  },
  {
    id: "place-4",
    name: "University Science & Research Archive",
    category: "campus",
    position: { lat: 37.7635, lng: -122.458 },
    address: "500 Parnassus Ave, San Francisco, CA 94143",
    rating: 4.9,
    openNow: true,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Parnassus+Library+San+Francisco",
  },
  {
    id: "place-5",
    name: "City Medical Center & Emergency Care",
    category: "hospital",
    position: { lat: 37.7858, lng: -122.435 },
    address: "2425 Geary Blvd, San Francisco, CA 94115",
    rating: 4.5,
    openNow: true,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=City+Medical+Center+Geary+Blvd",
  },
];
