// components/PasswordStrength.tsx
'use client';

import { useMemo } from 'react';

interface PasswordStrengthProps {
  password: string;
  showChecklist?: boolean;
}

interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  barColor: string;
  checks: {
    length: boolean;      // >= 8
    hasLower: boolean;    // a-z
    hasUpper: boolean;    // A-Z
    hasNumber: boolean;   // 0-9
    hasSymbol: boolean;   // simbol
  };
}

export function evaluatePassword(pwd: string): StrengthResult {
  const checks = {
    length: pwd.length >= 8,
    hasLower: /[a-z]/.test(pwd),
    hasUpper: /[A-Z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSymbol: /[^A-Za-z0-9]/.test(pwd),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (pwd.length === 0) score = 0;
  else if (passed <= 1) score = 1;
  else if (passed === 2) score = 2;
  else if (passed === 3 || passed === 4) score = 3;
  else if (passed === 5 && pwd.length >= 10) score = 4;
  else if (passed === 5) score = 3;

  const map = {
    0: { label: '—',        color: 'text-gray-400',    barColor: 'bg-gray-300 dark:bg-gray-600' },
    1: { label: 'Lemah',    color: 'text-red-500',     barColor: 'bg-red-500' },
    2: { label: 'Cukup',    color: 'text-orange-500',  barColor: 'bg-orange-500' },
    3: { label: 'Kuat',     color: 'text-yellow-500',  barColor: 'bg-yellow-500' },
    4: { label: 'Sangat Kuat', color: 'text-green-500', barColor: 'bg-green-500' },
  } as const;

  return { score, ...map[score], checks };
}

export default function PasswordStrength({
  password,
  showChecklist = true,
}: PasswordStrengthProps) {
  const result = useMemo(() => evaluatePassword(password), [password]);

  if (!password) return null;

  const pct = ((result.score / 4) * 100).toFixed(0);

  return (
    <div className="mt-2 space-y-1.5">
      {/* Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-[#2a2a4e] overflow-hidden">
          <div
            className={`h-full ${result.barColor} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[10px] font-semibold ${result.color} min-w-[70px] text-right`}>
          {result.label}
        </span>
      </div>

      {/* Checklist */}
      {showChecklist && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] mt-1">
          <Check ok={result.checks.length}       text="Min 8 karakter" />
          <Check ok={result.checks.hasLower}     text="Huruf kecil" />
          <Check ok={result.checks.hasUpper}     text="Huruf besar" />
          <Check ok={result.checks.hasNumber}    text="Angka" />
          <Check ok={result.checks.hasSymbol}    text="Simbol (!@#$…)" />
        </ul>
      )}
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li
      className={`flex items-center gap-1 ${
        ok ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      <i className={`fa-solid ${ok ? 'fa-circle-check' : 'fa-circle'} text-[8px]`} />
      <span>{text}</span>
    </li>
  );
}