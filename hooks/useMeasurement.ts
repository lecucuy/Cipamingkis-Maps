// hooks/useMeasurement.ts
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import type * as Leaflet from 'leaflet';

export type MeasureMode = 'none' | 'distance' | 'area' | 'circle';

export interface MeasureSegment { from: number; to: number; distance: number; }

export interface MeasureResult {
  id: string;
  type: Exclude<MeasureMode, 'none'>;
  distance?: number;
  perimeter?: number;
  area?: number;
  radius?: number;
  points: [number, number][];
  segments?: MeasureSegment[];
  createdAt: number;
}

interface Options { map: Leaflet.Map | null; L: any; }

const COLORS = { distance: '#3B82F6', area: '#10B981', circle: '#F59E0B' };

// 🔥 Nama pane custom
const PANE_NAME = 'measurementPane';

export function useMeasurement({ map, L }: Options) {
  const [mode, setModeState] = useState<MeasureMode>('none');
  const [points, setPointsState] = useState<[number, number][]>([]);
  const [results, setResultsState] = useState<MeasureResult[]>([]);
  const [liveInfo, setLiveInfo] = useState<any>(null);

  const tempLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const resultsLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const modeRef = useRef<MeasureMode>('none');
  const pointsRef = useRef<[number, number][]>([]);
  const resultsRef = useRef<MeasureResult[]>([]);

  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => { resultsRef.current = results; }, [results]);

  const formatDistance = useCallback((m?: number) => {
    if (!m || m <= 0) return '0 m';
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${Math.round(m)} m`;
  }, []);

  const formatArea = useCallback((m2?: number) => {
    if (!m2 || m2 <= 0) return '0 m²';
    if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
    if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
    return `${Math.round(m2)} m²`;
  }, []);

  /**
   * Ambil / buat ulang layer group measurement.
   * Pastikan selalu nempel di map.
   */
    const ensureLayer = useCallback((which: 'temp' | 'results'): Leaflet.LayerGroup | null => {
      if (!map || !L) return null;

      if (!map.getPane(PANE_NAME)) {
        const pane = map.createPane(PANE_NAME);
        pane.style.zIndex = '650';
        pane.style.pointerEvents = 'none';
      }

      const ref = which === 'temp' ? tempLayerRef : resultsLayerRef;
      if (!ref.current) {
        const g = L.layerGroup();
        (g as any)._isMeasurement = true;
        ref.current = g;
      }

      // ✅ pakai local variable supaya TS bisa narrow
      const layer = ref.current;
      if (layer && !map.hasLayer(layer)) {
        map.addLayer(layer);
      }
      return layer;
    }, [map, L]);

  // Setup awal
  useEffect(() => {
    if (!map || !L) return;
    ensureLayer('temp');
    ensureLayer('results');
    return () => {
      if (tempLayerRef.current && map) { try { map.removeLayer(tempLayerRef.current); } catch {} }
      if (resultsLayerRef.current && map) { try { map.removeLayer(resultsLayerRef.current); } catch {} }
      tempLayerRef.current = null;
      resultsLayerRef.current = null;
    };
  }, [map, L, ensureLayer]);

  // ==== DRAW TEMP LAYER ====
  useEffect(() => {
    if (!map || !L) return;
    const layer = ensureLayer('temp');
    if (!layer) return;

    layer.clearLayers();

    const pts = points;
    if (pts.length === 0) { setLiveInfo(null); return; }

    const color = mode === 'area' ? COLORS.area : mode === 'circle' ? COLORS.circle : COLORS.distance;
    const paneOpt = { pane: PANE_NAME }; // 🔥 semua layer di pane custom

    // Markers titik
    pts.forEach((p, i) => {
      layer.addLayer(
        L.circleMarker(p, {
          ...paneOpt,
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).bindTooltip(`Titik ${i + 1}`, { direction: 'top', permanent: false })
      );
    });

    if (mode === 'distance' && pts.length >= 2) {
      layer.addLayer(L.polyline(pts, { ...paneOpt, color, weight: 4, opacity: 0.95 }));
      let total = 0;
      const segments: MeasureSegment[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const d = turf.distance(
          turf.point([pts[i][1], pts[i][0]]),
          turf.point([pts[i + 1][1], pts[i + 1][0]]),
          { units: 'meters' }
        );
        segments.push({ from: i + 1, to: i + 2, distance: d });
        total += d;

        const midLat = (pts[i][0] + pts[i + 1][0]) / 2;
        const midLng = (pts[i][1] + pts[i + 1][1]) / 2;
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:white;padding:2px 7px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.8);">${formatDistance(d)}</div>`,
          iconSize: [60, 20], iconAnchor: [30, 10],
        });
        layer.addLayer(L.marker([midLat, midLng], { ...paneOpt, icon, interactive: false }));
      }
      setLiveInfo({ distance: total, segments });
    } else if (mode === 'area' && pts.length >= 3) {
      layer.addLayer(L.polygon(pts, { ...paneOpt, color, weight: 3, fillColor: color, fillOpacity: 0.25 }));
      const ring = pts.map(p => [p[1], p[0]]);
      const closed = [...ring, ring[0]];
      const area = turf.area(turf.polygon([closed]));
      const perimeter = turf.length(turf.lineString(closed), { units: 'meters' });
      setLiveInfo({ area, perimeter });
    } else if (mode === 'circle' && pts.length >= 2) {
      const center = turf.point([pts[0][1], pts[0][0]]);
      const edge = turf.point([pts[1][1], pts[1][0]]);
      const radius = turf.distance(center, edge, { units: 'meters' });
      layer.addLayer(L.circle(pts[0], { ...paneOpt, radius, color, weight: 3, fillColor: color, fillOpacity: 0.15 }));
      setLiveInfo({ radius, area: Math.PI * radius * radius });
    } else {
      setLiveInfo(null);
    }
    // ❌ TIDAK ADA layer.bringToFront() — pane z-index yang mengurus
  }, [points, mode, map, L, formatDistance, ensureLayer]);

  // ==== MAP CLICK ====
  useEffect(() => {
    if (!map) return;
    const onClick = (e: any) => {
      if (modeRef.current === 'none') return;
      const p: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (modeRef.current === 'circle' && pointsRef.current.length >= 2) {
        setPointsState([p]);
      } else {
        setPointsState([...pointsRef.current, p]);
      }
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map]);

  // ==== REDRAW RESULTS ====
  useEffect(() => {
    if (!map || !L) return;
    const layer = ensureLayer('results');
    if (!layer) return;
    layer.clearLayers();

    const paneOpt = { pane: PANE_NAME };

    results.forEach(r => {
      const color = r.type === 'area' ? COLORS.area : r.type === 'circle' ? COLORS.circle : COLORS.distance;

      if (r.type === 'distance') {
        layer.addLayer(L.polyline(r.points, { ...paneOpt, color, weight: 3, opacity: 0.9 }));
        r.points.forEach(p =>
          layer.addLayer(L.circleMarker(p, { ...paneOpt, radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }))
        );
        const last = r.points[r.points.length - 1];
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:white;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.8);">${formatDistance(r.distance)}</div>`,
          iconSize: [80, 22], iconAnchor: [40, 30],
        });
        layer.addLayer(L.marker(last, { ...paneOpt, icon, interactive: false }));
      } else if (r.type === 'area') {
        layer.addLayer(L.polygon(r.points, { ...paneOpt, color, weight: 3, fillColor: color, fillOpacity: 0.2 }));
        if (r.points.length >= 3) {
          const ring = r.points.map(p => [p[1], p[0]]);
          const closed = [...ring, ring[0]];
          const center = turf.centerOfMass(turf.polygon([closed]));
          const c = center.geometry.coordinates;
          const icon = L.divIcon({
            className: '',
            html: `<div style="background:${color};color:white;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.8);">${formatArea(r.area)}</div>`,
            iconSize: [80, 22], iconAnchor: [40, 11],
          });
          layer.addLayer(L.marker([c[1], c[0]], { ...paneOpt, icon, interactive: false }));
        }
      } else if (r.type === 'circle' && r.radius) {
        layer.addLayer(L.circle(r.points[0], { ...paneOpt, radius: r.radius, color, weight: 3, fillColor: color, fillOpacity: 0.15 }));
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:white;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.8);">r=${formatDistance(r.radius)}</div>`,
          iconSize: [80, 22], iconAnchor: [40, 11],
        });
        layer.addLayer(L.marker(r.points[0], { ...paneOpt, icon, interactive: false }));
      }
    });
  }, [results, map, L, formatArea, formatDistance, ensureLayer]);

  // ==== ACTIONS ====
  const startMeasure = useCallback((m: Exclude<MeasureMode, 'none'>) => {
    setPointsState([]);
    setModeState(m);
    modeRef.current = m;
    setLiveInfo(null);
    if (map) map.getContainer().style.cursor = 'crosshair';
  }, [map]);

  const undoLast = useCallback(() => {
    if (pointsRef.current.length === 0) return;
    setPointsState(pointsRef.current.slice(0, -1));
  }, []);

  const cancel = useCallback(() => {
    setPointsState([]);
    setModeState('none');
    modeRef.current = 'none';
    setLiveInfo(null);
    if (map) map.getContainer().style.cursor = '';
  }, [map]);

  const finish = useCallback(() => {
    const pts = pointsRef.current;
    const m = modeRef.current;
    if (m === 'none' || pts.length < 2) return;

    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let result: MeasureResult;

    if (m === 'distance') {
      const segments: MeasureSegment[] = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = turf.distance(turf.point([pts[i][1], pts[i][0]]), turf.point([pts[i + 1][1], pts[i + 1][0]]), { units: 'meters' });
        segments.push({ from: i + 1, to: i + 2, distance: d });
        total += d;
      }
      result = { id, type: 'distance', distance: total, segments, points: [...pts], createdAt: Date.now() };
    } else if (m === 'area') {
      if (pts.length < 3) return;
      const ring = pts.map(p => [p[1], p[0]]);
      const closed = [...ring, ring[0]];
      const area = turf.area(turf.polygon([closed]));
      const perimeter = turf.length(turf.lineString(closed), { units: 'meters' });
      result = { id, type: 'area', area, perimeter, points: [...pts], createdAt: Date.now() };
    } else {
      const center = turf.point([pts[0][1], pts[0][0]]);
      const edge = turf.point([pts[1][1], pts[1][0]]);
      const radius = turf.distance(center, edge, { units: 'meters' });
      result = { id, type: 'circle', radius, area: Math.PI * radius * radius, points: [...pts], createdAt: Date.now() };
    }

    setResultsState(prev => [...prev, result]);
    setPointsState([]);
    setModeState('none');
    modeRef.current = 'none';
    setLiveInfo(null);
    if (map) map.getContainer().style.cursor = '';
  }, [map]);

  const clearAll = useCallback(() => {
    setResultsState([]);
    setPointsState([]);
    setModeState('none');
    modeRef.current = 'none';
    setLiveInfo(null);
    if (map) map.getContainer().style.cursor = '';
  }, [map]);

  const removeResult = useCallback((id: string) => {
    setResultsState(prev => prev.filter(r => r.id !== id));
  }, []);

  return {
    mode, points, results, liveInfo,
    startMeasure, undoLast, cancel, finish, clearAll, removeResult,
    formatDistance, formatArea,
  };
}