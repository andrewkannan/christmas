import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GeoJSONSourceSpecification,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from 'maplibre-gl';
// Vite emits the self-contained MapLibre worker as a hashed static asset and gives us its URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {
  ARRIVAL_TOUR,
  KING_OF_GLORY_INVITE,
  NEARBY_LANDMARKS,
  VENUE_FOOTPRINT,
} from '../invite/kingOfGloryInvite.ts';
import { ArrowRightIcon, MapPinIcon } from '../components/Icons.tsx';

/** Free, key-less vector tiles (OpenFreeMap · OpenMapTiles · OpenStreetMap data). */
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const VENUE_LNG_LAT: [number, number] = [KING_OF_GLORY_INVITE.venue.lng, KING_OF_GLORY_INVITE.venue.lat];
const PAPER_BACKGROUND = '#f6efe2';
const GOLD = '#f0b443';
const FALLBACK_TOWER_HEIGHT_M = 60;
const INTRO_STOP = 1; // "Look for the gold tower"

type MapStatus = 'loading' | 'ready' | 'error';
type LocateState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'shown'; distanceKm: number }
  | { kind: 'error'; message: string };

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/** Great-circle distance in km (straight line, not driving distance). */
function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Footprint grown ~4% around its centroid so the gold tower fully wraps the base-map building. */
function buildVenueGeoJson(): GeoJSONSourceSpecification['data'] {
  const pts = VENUE_FOOTPRINT.slice(0, -1);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const ring = VENUE_FOOTPRINT.map(([x, y]) => [cx + (x - cx) * 1.04, cy + (y - cy) * 1.04]);
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } },
      { type: 'Feature', properties: { glow: true }, geometry: { type: 'Point', coordinates: [cx, cy] } },
    ],
  };
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function buildVenuePin(): HTMLElement {
  const root = el('div', 'rg-pin');
  root.setAttribute('aria-hidden', 'true');
  const dot = el('span', 'rg-pin__dot', '★');
  const label = el('span', 'rg-pin__label');
  label.append(
    el('strong', '', KING_OF_GLORY_INVITE.venue.building),
    el('span', '', `${KING_OF_GLORY_INVITE.venue.floor} · ${KING_OF_GLORY_INVITE.venue.room}`),
    el('em', '', `${KING_OF_GLORY_INVITE.shortDateLabel} · ${KING_OF_GLORY_INVITE.timeLabel}`)
  );
  root.append(dot, label);
  return root;
}

export function VenueMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [active, setActive] = useState<number>(() => (prefersReducedMotion() ? INTRO_STOP : 0));
  const [locate, setLocate] = useState<LocateState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let observer: IntersectionObserver | null = null;
    let introTimer: number | undefined;

    (async () => {
      try {
        const [lib] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
        if (cancelled || !containerRef.current) return;
        libRef.current = lib;
        lib.setWorkerUrl(maplibreWorkerUrl);

        const startStop = ARRIVAL_TOUR[prefersReducedMotion() ? INTRO_STOP : 0];
        map = new lib.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          ...startStop.camera,
          // One-finger swipes keep scrolling the page on phones; two fingers move the map.
          cooperativeGestures: true,
          attributionControl: { compact: true },
          maxPitch: 75,
        });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl({ visualizePitch: true }), 'top-right');

        for (const lm of NEARBY_LANDMARKS) {
          const tag = el('div', 'rg-landmark');
          tag.setAttribute('aria-hidden', 'true');
          tag.append(el('span', 'rg-landmark__dot'), el('span', 'rg-landmark__name', lm.name));
          new lib.Marker({ element: tag, anchor: 'left', offset: [-6, 0] }).setLngLat([lm.lng, lm.lat]).addTo(map);
        }
        new lib.Marker({ element: buildVenuePin(), anchor: 'top', offset: [0, -24] })
          .setLngLat(VENUE_LNG_LAT)
          .addTo(map);

        let loaded = false;
        let towerHeight = 0;
        // Registering an error listener also stops MapLibre logging tile hiccups to the console.
        map.on('error', () => {
          if (!loaded && !cancelled) setStatus('error');
        });

        const syncTowerHeight = () => {
          if (!map?.getLayer('rg-venue-tower')) return;
          const baseLayer = map.getStyle().layers?.find((l) => l.type === 'fill-extrusion' && l.id !== 'rg-venue-tower');
          if (!baseLayer) return;
          const hit = map.queryRenderedFeatures(map.project(VENUE_LNG_LAT), { layers: [baseLayer.id] })[0];
          const h = Number(hit?.properties?.render_height);
          if (Number.isFinite(h) && h > 0 && Math.abs(h - towerHeight) > 0.5) {
            towerHeight = h;
            map.setPaintProperty('rg-venue-tower', 'fill-extrusion-height', h + 1.5);
          }
        };

        map.once('load', () => {
          loaded = true;
          if (cancelled || !map) return;
          // Warm "paper" base to match the invitation card.
          for (const layer of map.getStyle().layers ?? []) {
            if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', PAPER_BACKGROUND);
          }

          // Light the venue tower in gold with a soft halo on the ground.
          map.addSource('rg-venue', { type: 'geojson', data: buildVenueGeoJson() });
          map.addLayer({
            id: 'rg-venue-glow',
            type: 'circle',
            source: 'rg-venue',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-color': GOLD,
              'circle-opacity': 0.45,
              'circle-blur': 1,
              'circle-pitch-alignment': 'map',
              'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 13, 10, 18, 140],
            },
          });
          map.addLayer({
            id: 'rg-venue-tower',
            type: 'fill-extrusion',
            source: 'rg-venue',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-extrusion-color': GOLD,
              'fill-extrusion-height': FALLBACK_TOWER_HEIGHT_M,
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.95,
              'fill-extrusion-vertical-gradient': true,
            },
          });
          map.on('idle', syncTowerHeight);
          setStatus('ready');

          // Cinematic intro: once the map is on screen, glide from the neighbourhood to the tower.
          if (!prefersReducedMotion() && containerRef.current && 'IntersectionObserver' in window) {
            observer = new IntersectionObserver(
              (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                observer?.disconnect();
                introTimer = window.setTimeout(() => {
                  if (cancelled || !map) return;
                  setActive(INTRO_STOP);
                  map.flyTo({ ...ARRIVAL_TOUR[INTRO_STOP].camera, duration: 4200, curve: 1.3 });
                }, 500);
              },
              { threshold: 0.45 }
            );
            observer.observe(containerRef.current);
          }
        });
      } catch {
        // WebGL unavailable, offline, or blocked tiles — show the text fallback instead.
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(introTimer);
      observer?.disconnect();
      userMarkerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  const goToStop = useCallback((index: number) => {
    const stop = ARRIVAL_TOUR[index];
    if (!stop) return;
    setActive(index);
    // flyTo automatically jumps instead of animating when the user prefers reduced motion.
    mapRef.current?.flyTo({ ...stop.camera, duration: 2400 });
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
        if (map && lib) {
          if (!userMarkerRef.current) {
            const dot = el('div', 'rg-user-dot');
            dot.setAttribute('aria-hidden', 'true');
            userMarkerRef.current = new lib.Marker({ element: dot });
          }
          userMarkerRef.current.setLngLat(user).addTo(map);
          map.fitBounds(new lib.LngLatBounds(user, user).extend(VENUE_LNG_LAT), {
            padding: { top: 90, bottom: 120, left: 60, right: 60 },
            maxZoom: 15.5,
            pitch: 35,
            bearing: 0,
            duration: 1800,
          });
        }
        setActive(-1);
        setLocate({ kind: 'shown', distanceKm: haversineKm(user, VENUE_LNG_LAT) });
      },
      (err) => {
        setLocate({
          kind: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Location is switched off — no problem. Tap Google Maps or Waze above for directions.'
              : 'I couldn’t find your location just now. Try again, or use Google Maps / Waze above.',
        });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }, []);

  const activeStop = active >= 0 ? ARRIVAL_TOUR[active] : undefined;
  const nextIndex = active >= 0 && active < ARRIVAL_TOUR.length - 1 ? active + 1 : 0;

  return (
    <div className="rg-tour-layout">
      <div className="rg-map-col">
        <div className="rg-map-frame">
          <div
            ref={containerRef}
            className="rg-map"
            role="region"
            aria-label={`Interactive 3D map of ${KING_OF_GLORY_INVITE.venue.building}, Jalan Dato Abdullah Tahir, Johor Bahru`}
          />

          {status === 'ready' && (
            <div className="rg-map-hud">
              <span className="rg-map-hud__text" aria-live="polite">
                {activeStop ? (
                  <>
                    <span className="rg-map-hud__count">
                      Stop {active + 1} of {ARRIVAL_TOUR.length}
                    </span>
                    <strong>{activeStop.label}</strong>
                  </>
                ) : (
                  <strong>You → Menara Zurich</strong>
                )}
              </span>
              <button type="button" className="rg-map-hud__next" onClick={() => goToStop(nextIndex)}>
                <span>{nextIndex === 0 ? 'Start tour' : 'Next stop'}</span>
                <ArrowRightIcon size={16} />
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="rg-map-overlay" role="status">
              <span className="rg-spinner" aria-hidden="true" />
              <span>Loading your map…</span>
            </div>
          )}

          {status === 'error' && (
            <div className="rg-map-overlay rg-map-overlay--error" role="status">
              <MapPinIcon size={28} />
              <strong>The map can’t load right now</strong>
              <span>Google Maps and Waze above will still take you straight to Menara Zurich.</span>
            </div>
          )}
        </div>

        {status === 'ready' && (
          <div className="rg-locate">
            <button
              type="button"
              className="rg-btn rg-btn--ghost rg-btn--sm"
              onClick={showMyLocation}
              disabled={locate.kind === 'locating'}
            >
              <MapPinIcon size={16} />
              <span>{locate.kind === 'locating' ? 'Finding you…' : 'How far am I?'}</span>
            </button>
            <p className="rg-locate__note" aria-live="polite">
              {locate.kind === 'shown'
                ? `You’re about ${locate.distanceKm < 1 ? locate.distanceKm.toFixed(1) : Math.round(locate.distanceKm)} km away as the crow flies. Google Maps or Waze will give you the driving route.`
                : locate.kind === 'error'
                  ? locate.message
                  : 'Your location stays on your phone — it’s only used to show where you are.'}
            </p>
          </div>
        )}
      </div>

      <ol className="rg-tour" role="list" aria-label="Your arrival tour">
        {ARRIVAL_TOUR.map((stop, i) => (
          <li key={stop.id}>
            <button
              type="button"
              className="rg-tour__stop"
              aria-current={i === active ? 'step' : undefined}
              onClick={() => goToStop(i)}
            >
              <span className="rg-tour__num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="rg-tour__copy">
                <strong>{stop.title}</strong>
                <span>{stop.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
