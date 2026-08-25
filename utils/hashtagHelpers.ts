// utils/hashtagHelpers.ts

/**
 * Ekstrak semua hashtag dari string (case-insensitive)
 */
export const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/#[\w.]+/g);
  if (!matches) return [];
  const tags = matches.map(tag => tag.slice(1).toLowerCase().trim());
  return [...new Set(tags)];
};

/**
 * Filter array fitur berdasarkan tag tertentu
 */
export const filterFeaturesByTag = <T extends { tags?: string[] }>(
  features: T[],
  tag: string | null
): T[] => {
  if (!tag) return features;
  const lowerTag = tag.toLowerCase();
  return features.filter(f => f.tags?.includes(lowerTag));
};

/**
 * Ambil semua tag unik dari kumpulan fitur
 */
export const getAllUniqueTags = <T extends { tags?: string[] }>(
  features: T[]
): string[] => {
  const tagSet = new Set<string>();
  features.forEach(f => f.tags?.forEach(t => tagSet.add(t)));
  return Array.from(tagSet);
};