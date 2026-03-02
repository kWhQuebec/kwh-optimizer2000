import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";

export interface AddressComponents {
  formattedAddress: string;
  streetNumber: string;
  route: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onPlaceSelected?: (components: AddressComponents) => void;
  placeholder?: string;
  "data-testid"?: string;
  disabled?: boolean;
  className?: string;
}

function ensurePlacesLibrary(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    if (window.google?.maps) {
      const poll = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); resolve(); }, 5000);
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function parsePlace(place: google.maps.places.PlaceResult): AddressComponents {
  const components: AddressComponents = {
    formattedAddress: "",
    streetNumber: "",
    route: "",
    city: "",
    province: "",
    postalCode: "",
    lat: 0,
    lng: 0,
  };

  if (place.formatted_address) {
    components.formattedAddress = place.formatted_address;
  }

  if (place.geometry?.location) {
    components.lat = place.geometry.location.lat();
    components.lng = place.geometry.location.lng();
  }

  for (const component of place.address_components || []) {
    const types = component.types;
    if (types.includes("street_number")) {
      components.streetNumber = component.long_name;
    } else if (types.includes("route")) {
      components.route = component.long_name;
    } else if (types.includes("locality")) {
      components.city = component.long_name;
    } else if (types.includes("sublocality_level_1") && !components.city) {
      components.city = component.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      components.province = component.long_name;
    } else if (types.includes("postal_code")) {
      components.postalCode = component.long_name;
    }
  }

  if (!components.formattedAddress && (components.streetNumber || components.route)) {
    components.formattedAddress = [components.streetNumber, components.route].filter(Boolean).join(" ");
  }

  return components;
}

export function AddressAutocomplete({
  value,
  onChange,
  onBlur,
  onPlaceSelected,
  placeholder,
  "data-testid": testId,
  disabled,
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [isReady, setIsReady] = useState(false);

  onChangeRef.current = onChange;
  onPlaceSelectedRef.current = onPlaceSelected;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    ensurePlacesLibrary(apiKey).then(() => {
      if (!cancelled) setIsReady(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [apiKey]);

  const handlePlaceChanged = useCallback(() => {
    const ac = autocompleteRef.current;
    if (!ac) return;

    const place = ac.getPlace();
    if (!place || !place.address_components) return;

    const parsed = parsePlace(place);

    const streetAddress = [parsed.streetNumber, parsed.route].filter(Boolean).join(" ");
    if (onChangeRef.current && streetAddress) {
      onChangeRef.current(streetAddress);
    }

    if (onPlaceSelectedRef.current) {
      onPlaceSelectedRef.current(parsed);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !inputRef.current || autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "ca" },
      fields: ["address_components", "formatted_address", "geometry"],
    });

    ac.addListener("place_changed", handlePlaceChanged);
    autocompleteRef.current = ac;

    return () => {
      google.maps.event.clearInstanceListeners(ac);
      autocompleteRef.current = null;
    };
  }, [isReady, handlePlaceChanged]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      data-testid={testId}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  );
}
