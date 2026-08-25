// components/HashtagFilterBar.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  tags: string[];
  activeTag: string | null;
  onTagClick: (tag: string | null) => void;
}

export const HashtagFilterBar: React.FC<Props> = ({ tags, activeTag, onTagClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, tags]);

  const scrollByAmount = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -140 : 140, behavior: 'smooth' });
  };

  if (tags.length === 0) return null;

  return (
    <div className="relative flex items-center">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          className="shrink-0 z-10 w-6 h-6 mr-1 rounded-full bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] shadow flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-[#00c8ff] hover:border-[#00c8ff]/60 transition"
        >
          <i className="fa-solid fa-chevron-left text-[10px]"></i>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => onTagClick(null)}
          className={`shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full border transition-all ${
            !activeTag
              ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
              : 'bg-gray-50 dark:bg-[#0f0f23] border-gray-200 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:border-[#00c8ff]/60'
          }`}
        >
          Semua
        </button>
        {tags.map(tag => (
          <button
            key={tag}
            onClick={() => onTagClick(tag === activeTag ? null : tag)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full border transition-all ${
              activeTag === tag
                ? 'bg-[#00c8ff] text-white border-[#00c8ff]'
                : 'bg-gray-50 dark:bg-[#0f0f23] border-gray-200 dark:border-[#2a2a4e] text-gray-600 dark:text-gray-300 hover:border-[#00c8ff]/60'
            }`}
          >
            <i className="fa-solid fa-hashtag text-[9px] opacity-70"></i>
            {tag}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          className="shrink-0 z-10 w-6 h-6 ml-1 rounded-full bg-white dark:bg-[#1a1a2e] border border-gray-200 dark:border-[#2a2a4e] shadow flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-[#00c8ff] hover:border-[#00c8ff]/60 transition"
        >
          <i className="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
      )}
    </div>
  );
};