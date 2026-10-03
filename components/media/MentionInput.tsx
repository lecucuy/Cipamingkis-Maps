'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { mentionApi, MentionUser } from '@/lib/api/uploads';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onMentionsChange: (userIds: string[]) => void;
  token?: string;
  placeholder?: string;
}

export default function MentionInput({
  value, onChange, onMentionsChange, token, placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentioned, setMentioned] = useState<MentionUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect @ query
  const getQuery = useCallback((text: string, caretPos: number): string | null => {
    const before = text.slice(0, caretPos);
    const match = before.match(/@([\w.-]*)$/);
    return match ? match[1] : null;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    const caret = e.target.selectionStart ?? newVal.length;
    const q = getQuery(newVal, caret);
    if (q === null) {
      setShowSuggest(false);
      return;
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!token) return;
      try {
        const r = await mentionApi.search(token, q);
        setSuggestions(r.items || []);
        setShowSuggest(r.items?.length > 0);
        setActiveIdx(0);
      } catch { setShowSuggest(false); }
    }, 200);
  };

  const insertMention = (user: MentionUser) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(/@([\w.-]*)$/, `@${user.username} `);
    const newText = replaced + after;
    onChange(newText);

    // Track mentioned user
    const newMentioned = [...mentioned.filter(u => u.id !== user.id), user];
    setMentioned(newMentioned);
    onMentionsChange(newMentioned.map(u => u.id));

    setShowSuggest(false);
    setTimeout(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggest) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[activeIdx]) insertMention(suggestions[activeIdx]); }
    else if (e.key === 'Escape') { setShowSuggest(false); }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder={placeholder || 'Tulis caption... Tag @user untuk kolaborasi'}
        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] focus:outline-none focus:ring-2 focus:ring-[#00c8ff] resize-none"
      />

      {/* Mentioned chips */}
      {mentioned.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {mentioned.map(u => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c8ff]/10 text-[#00c8ff] text-[10px] font-medium border border-[#00c8ff]/30"
            >
              <i className="fa-solid fa-at text-[8px]"></i>
              {u.username}
              <button
                type="button"
                onClick={() => {
                  const filtered = mentioned.filter(x => x.id !== u.id);
                  setMentioned(filtered);
                  onMentionsChange(filtered.map(x => x.id));
                }}
                className="w-3.5 h-3.5 rounded-full hover:bg-[#00c8ff]/20 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-[8px]"></i>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Autocomplete dropdown */}
      {showSuggest && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-200 dark:border-[#2a2a4e] shadow-2xl max-h-64 overflow-y-auto">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition ${
                i === activeIdx ? 'bg-[#00c8ff]/10' : 'hover:bg-gray-50 dark:hover:bg-[#2a2a4e]'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00c8ff] to-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : u.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1a1a2e] dark:text-white truncate">
                  @{u.username}
                  {u.full_name && <span className="text-gray-400 font-normal"> · {u.full_name}</span>}
                </p>
                {u.role && (
                  <p className="text-[10px] text-gray-500 uppercase">{u.role}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}