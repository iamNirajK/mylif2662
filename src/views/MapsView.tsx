import React, { useState, useEffect } from "react";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import {
  GOOGLE_MAPS_API_KEY,
  MAPS_INTERNAL_ATTRIBUTION_ID,
  DEFAULT_MAP_CENTER,
  SAMPLE_STUDY_PLACES,
  PlaceMarker,
} from "../services/maps.ts";
import { Language } from "../types.ts";
import {
  MapPin,
  Search,
  Navigation,
  ExternalLink,
  Copy,
  Check,
  Star,
  Clock,
  Compass,
  Building,
  Coffee,
  BookOpen,
} from "lucide-react";

interface MapsViewProps {
  language: Language;
}

export const MapsView: React.FC<MapsViewProps> = ({ language }) => {
  const [places, setPlaces] = useState<PlaceMarker[]>(SAMPLE_STUDY_PLACES);
  const [selectedPlace, setSelectedPlace] = useState<PlaceMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Filtered places
  const filteredPlaces = places.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === "all") return true;
    return p.category === categoryFilter;
  });

  // User location detection
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLoc(coords);
        setCenter(coords);
        setLocating(false);
      },
      (err) => {
        console.warn("Location error:", err);
        alert("Unable to retrieve location. Please check browser permissions.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "library":
      case "study":
        return <BookOpen className="w-3.5 h-3.5 text-indigo-400" />;
      case "cafe":
        return <Coffee className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Building className="w-3.5 h-3.5 text-violet-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/15 text-emerald-400 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {language === "hi" ? "गूगल मैप्स व स्थान बुद्धिमत्ता" : "Google Maps & Location Intelligence"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "hi"
                ? "निकटतम पुस्तकालय, शांत अध्ययन केंद्र, कैफे व दिशा-निर्देश खोजें"
                : "Explore nearby libraries, quiet study lounges, campus centers, and get directions"}
            </p>
          </div>
        </div>

        <button
          onClick={handleGetLocation}
          disabled={locating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
        >
          <Navigation className={`w-3.5 h-3.5 text-emerald-400 ${locating ? "animate-spin" : ""}`} />
          <span>{locating ? "Locating..." : language === "hi" ? "मेरी लोकेशन" : "Find My Location"}</span>
        </button>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === "hi" ? "पुस्तकालय, कैफे या अध्ययन स्थल खोजें..." : "Search libraries, cafes, or study locations..."
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs md:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800 overflow-x-auto shrink-0">
          {[
            { id: "all", label: "All Places" },
            { id: "library", label: "Libraries" },
            { id: "study", label: "Study Hubs" },
            { id: "cafe", label: "Cafes" },
            { id: "campus", label: "Campuses" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                categoryFilter === cat.id
                  ? "bg-slate-800 text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Interactive Map & Places Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive Google Map Container */}
        <div className="lg:col-span-8 rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 min-h-[480px] h-[520px] relative shadow-xl">
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              defaultCenter={center}
              defaultZoom={13}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={[MAPS_INTERNAL_ATTRIBUTION_ID]}
              style={{ width: "100%", height: "100%" }}
              gestureHandling="greedy"
              disableDefaultUI={false}
            >
              {/* User location pin if detected */}
              {userLoc && (
                <AdvancedMarker position={userLoc} title="Your Location">
                  <div className="w-4 h-4 bg-cyan-400 rounded-full border-2 border-white shadow-lg animate-pulse" />
                </AdvancedMarker>
              )}

              {/* Place markers */}
              {filteredPlaces.map((place) => (
                <AdvancedMarker
                  key={place.id}
                  position={place.position}
                  onClick={() => setSelectedPlace(place)}
                >
                  <Pin
                    background="#6366f1"
                    glyphColor="#ffffff"
                    borderColor="#4338ca"
                  />
                </AdvancedMarker>
              ))}

              {/* InfoWindow for selected place */}
              {selectedPlace && (
                <InfoWindow
                  position={selectedPlace.position}
                  onCloseClick={() => setSelectedPlace(null)}
                >
                  <div className="p-2 text-slate-900 max-w-xs space-y-1.5 font-sans">
                    <h4 className="font-bold text-xs">{selectedPlace.name}</h4>
                    <p className="text-[11px] text-slate-600">{selectedPlace.address}</p>
                    {selectedPlace.rating && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{selectedPlace.rating} / 5.0</span>
                      </div>
                    )}
                    <a
                      href={selectedPlace.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-semibold hover:underline pt-1"
                    >
                      <span>View in Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </APIProvider>
        </div>

        {/* Places List Sidebar */}
        <div className="lg:col-span-4 space-y-3 overflow-y-auto max-h-[520px] pr-1">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>{filteredPlaces.length} Study Places Found</span>
            <span className="font-mono text-[10px]">Live Markers Active</span>
          </div>

          {filteredPlaces.map((place) => {
            const isSelected = selectedPlace?.id === place.id;
            return (
              <div
                key={place.id}
                onClick={() => {
                  setSelectedPlace(place);
                  setCenter(place.position);
                }}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-2.5 ${
                  isSelected
                    ? "bg-violet-950/20 border-violet-500/50"
                    : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900/90"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      {getCategoryIcon(place.category)}
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {place.category}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold text-white">{place.name}</h3>
                  </div>

                  {place.rating && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/40 text-amber-300 text-[10px] font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{place.rating}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{place.address}</span>
                </div>

                {/* NEVER HIDE LINKS: Clickable Google Maps Action Links */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <a
                    href={place.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(place.mapsUrl);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-300 transition"
                    title="Copy Google Maps URL"
                  >
                    {copiedUrl === place.mapsUrl ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
