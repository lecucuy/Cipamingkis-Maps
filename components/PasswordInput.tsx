// components/PasswordInput.tsx
'use client';

import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  minLength = 6,
  required = false,
  autoComplete = 'new-password',
  disabled = false,
  className = '',
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        spellCheck={false}
        className={`w-full px-4 py-2 pr-11 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/30 transition-all ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-[#00c8ff] hover:bg-gray-100 dark:hover:bg-[#2a2a4e] transition"
        tabIndex={-1}
      >
        <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
      </button>
    </div>
  );
}