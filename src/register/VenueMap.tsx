import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
// Vite emits the self-contained MapLibre worker as a hashed static asset and gives us its URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { KING_OF_GLORY_INVITE } from '../invite/kingOfGloryInvite.ts';

/** Free, key-less vector tiles (OpenFreeMap · OpenMapTiles · OpenStreetMap data). */
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const VENUE_LNG_LAT: [number, number] = [KING_OF_GLORY_INVITE.venue.lng, KING_OF_GLORY_INVITE.venue.lat];
const VENUE_VIEW = { center: VENUE_LNG_LAT, zoom: 16.2, pitch: 55, bearing: -18 };
const PAPER_BACKGROUND = '#f5eedf';

type MapStatus = 'loading' | 'ready' | 'error';
type LocateState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'shown'; distanceKm: number }
  | { kind: 'error'; message: string };

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Great-circle distance in km (straight line, not driving distance). */
function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function buildVenuePinElement(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'kog-map-pin';
  root.setAttribute('aria-hidden', 'true');

  const dot = document.createElement('span');
  dot.className = 'kog-map-pin__dot';
  dot.textContent = '★';

  const label = document.createElement('span');
  label.className = 'kog-map-pin__label';
  const name = document.createElement('strong');
  name.textContent = KING_OF_GLORY_INVITE.venue.building;
  const floor = document.createElement('span');
  floor.textContent = `${KING_OF_GLORY_INVITE.venue.floor} · ${KING_OF_GLORY_INVITE.venue.room}`;
  const when = document.createElement('em');
  when.textContent = `${KING_OF_GLORY_INVITE.shortDateLabel} · ${KING_OF_GLORY_INVITE.timeLabel}`;
  label.append(name, floor, when);

  root.append(dot, label);
  return root;
}

function buildUserDotElement(): HTMLElement {
  const dot = document.createElement('div');
  dot.className = 'kog-map-user-dot';
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

export function VenueMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [locate, setLocate] = useState<LocateState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      try {
        const [lib] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        if (cancelled || !containerRef.current) return;
        libRef.current = lib;
        lib.setWorkerUrl(maplibreWorkerUrl);

        map = new lib.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          ...VENUE_VIEW,
          // One-finger swipes keep scrolling the page on phones; two fingers move the map.
          cooperativeGestures: true,
          attributionControl: { compact: true },
          maxPitch: 70,
        });
        mapRef.current = map;

        map.addControl(new lib.NavigationControl({ visualizePitch: true }), 'top-right');

        new lib.Marker({ element: buildVenuePinElement(), anchor: 'top', offset: [0, -22] })
          .setLngLat(VENUE_LNG_LAT)
          .addTo(map);

        let loaded = false;
        // Registering an error listener also stops MapLibre from logging tile hiccups to the console.
        map.on('error', () => {
          if (!loaded && !cancelled) setStatus('error');
        });
        map.once('load', () => {
          loaded = true;
          if (cancelled || !map) return;
          // Warm "paper" base to match the invitation card.
          for (const layer of map.getStyle().layers ?? []) {
            if (layer.type === 'background') {
              map.setPaintProperty(layer.id, 'background-color', PAPER_BACKGROUND);
            }
          }
          setStatus('ready');
        });
      } catch {
        // WebGL unavailable, offline, or blocked tiles — show the text fallback instead.
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      userMarkerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (prefersReducedMotion()) map.jumpTo(VENUE_VIEW);
    else map.flyTo({ ...VENUE_VIEW, duration: 1200 });
  }, []);

  const showMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocate({ kind: 'error', message: 'Your browser can’t share location. Use Google Maps or Waze above instead.' });
      return;
    }
    setLocate({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        const lib = libRef.current;
        const user: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const distanceKm = haversineKm(user, VENUE_LNG_LAT);
        if (map && lib) {
          if (!userMarkerRef.current) {
            userMarkerRef.current = new lib.Marker({ element: buildUserDotElement() });
          }
          userMarkerRef.current.setLngLat(user).addTo(map);
          const bounds = new lib.LngLatBounds(user, user).extend(VENUE_LNG_LAT);
          map.fitBounds(bounds, {
            padding: { top: 90, bottom: 110, left: 60, right: 60 },
            maxZoom: 15.5,
            pitch: 40,
            duration: prefersReducedMotion() ? 0 : 1400,
          });
        }
        setLocate({ kind: 'shown', distanceKm });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is off. That’s okay — tap Google Maps or Waze above for directions.'
            : 'We couldn’t find your location right now. Please try again, or use Google Maps / Waze above.';
        setLocate({ kind: 'error', message });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }, []);

  return (
    <div className="kog-map-block">
      <div className="kog-map-frame">
        <div
          ref={containerRef}
          className="kog-map"
          role="region"
          aria-label={`Map showing ${KING_OF_GLORY_INVITE.venue.building}, Jalan Dato Abdullah Tahir, Johor Bahru`}
        />

        {status === 'ready' && (
          <button type="button" className="kog-map-chip" onClick={recenter}>
            Back to venue
          </button>
        )}

        {status === 'loading' && (
          <div className="kog-map-overlay" role="status">
            <span className="kog-spinner" aria-hidden="true" />
            <span>Loading map…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="kog-map-overlay kog-map-overlay--error" role="status">
            <strong>Map unavailable right now</strong>
            <span>
              Use the Google Maps or Waze buttons above — they’ll take you straight to{' '}
              {KING_OF_GLORY_INVITE.venue.building}.
            </span>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="kog-map-locate">
          <button
            type="button"
            className="kog-btn kog-btn--outline kog-btn--sm"
            onClick={showMyLocation}
            disabled={locate.kind === 'locating'}
          >
            {locate.kind === 'locating' ? 'Finding you…' : 'Show my location on the map'}
          </button>
          <p className="kog-map-locate__note" aria-live="polite">
            {locate.kind === 'shown'
              ? `You’re about ${locate.distanceKm < 1 ? locate.distanceKm.toFixed(1) : Math.round(locate.distanceKm)} km away (straight line). Tap Google Maps or Waze for the driving route.`
              : locate.kind === 'error'
                ? locate.message
                : 'Your location stays on your phone — it’s only used to show where you are.'}
          </p>
        </div>
      )}
    </div>
  );
}
