"use client";

import Script from "next/script";
import { useRef, useEffect, useCallback } from "react";

interface PlacesInputProps {
  value: string;
  onChange: (value: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

declare global {
  interface Window {
    __googleMapsReady?: boolean;
    __googleMapsCallbacks?: Array<() => void>;
  }
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function PlacesInput({ value, onChange, placeholder, className, id }: PlacesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || autocompleteRef.current) return;
    if (!window.google?.maps?.places) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "MX" },
      fields: ["formatted_address", "geometry"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      const address = place.formatted_address ?? inputRef.current?.value ?? "";
      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();
      onChange(address, lat !== undefined && lng !== undefined ? { lat, lng } : undefined);
    });
  }, [onChange]);

  useEffect(() => {
    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      window.__googleMapsCallbacks = window.__googleMapsCallbacks ?? [];
      window.__googleMapsCallbacks.push(initAutocomplete);
    }
  }, [initAutocomplete]);

  function handleScriptLoad() {
    window.__googleMapsReady = true;
    window.__googleMapsCallbacks?.forEach((cb) => cb());
    window.__googleMapsCallbacks = [];
    initAutocomplete();
  }

  return (
    <>
      <Script
        id="google-maps-places"
        src={`https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`}
        strategy="lazyOnload"
        onLoad={handleScriptLoad}
      />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (pasted.includes("maps.google") || pasted.includes("goo.gl") || pasted.includes("maps.app")) {
            e.preventDefault();
            onChange(pasted);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
    </>
  );
}
