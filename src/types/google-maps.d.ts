declare namespace google.maps {
  class Map {
    constructor(element: HTMLElement, opts?: any);
    panTo(latLng: any): void;
    setCenter(latLng: any): void;
    setZoom(zoom: number): void;
    getZoom(): number;
    getBounds(): any;
    fitBounds(bounds: any, padding?: any): void;
    addListener(event: string, handler: () => void): void;
  }
  class Marker {
    constructor(opts?: any);
    setMap(map: Map | null): void;
    getPosition(): any;
    addListener(event: string, handler: () => void): void;
  }
  class LatLngBounds {
    constructor();
    extend(latLng: any): LatLngBounds;
    contains(latLng: any): boolean;
  }
  class Size { constructor(w: number, h: number); }
  class Point { constructor(x: number, y: number); }
  class Geocoder {
    geocode(req: any, cb: (results: any, status: string) => void): void;
  }
  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: any);
      getPlace(): any;
      addListener(event: string, handler: () => void): void;
    }
  }
  namespace marker {
    class AdvancedMarkerElement { setMap(map: any): void; }
  }
  namespace ControlPosition { const BOTTOM_LEFT: number; }
}
