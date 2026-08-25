// hooks/useHashtagFilter.ts
import { useState, useMemo } from 'react';

interface HashtagFilterReturn {
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  filteredPoints: any[];
  filteredLines: any[];
  filteredPolygons: any[];
  allTags: string[];
}

export const useHashtagFilter = (geoData: any): HashtagFilterReturn => {
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const allTags = useMemo(() => {
    if (!geoData) return [];
    const all = [
      ...(geoData.points || []),
      ...(geoData.lines || []),
      ...(geoData.polygons || []),
    ];
    const tagSet = new Set<string>();
    all.forEach(f => f.tags?.forEach((t: string) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [geoData]);

  const filteredPoints = useMemo(() => {
    if (!geoData) return [];
    if (!tagFilter) return geoData.points || [];
    return (geoData.points || []).filter((p: any) =>
      p.tags?.includes(tagFilter)
    );
  }, [geoData, tagFilter]);

  const filteredLines = useMemo(() => {
    if (!geoData) return [];
    if (!tagFilter) return geoData.lines || [];
    return (geoData.lines || []).filter((l: any) =>
      l.tags?.includes(tagFilter)
    );
  }, [geoData, tagFilter]);

  const filteredPolygons = useMemo(() => {
    if (!geoData) return [];
    if (!tagFilter) return geoData.polygons || [];
    return (geoData.polygons || []).filter((p: any) =>
      p.tags?.includes(tagFilter)
    );
  }, [geoData, tagFilter]);

  return { tagFilter, setTagFilter, filteredPoints, filteredLines, filteredPolygons, allTags };
};