// frontend/components/LoginForm.tsx
'use client';

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
}

export default function LoginForm({ redirectTo = "/", onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const router = useRouter();

  const MAX_ATTEMPTS = 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Jika sudah mencapai batas, jangan lanjut
    if (attempts >= MAX_ATTEMPTS) {
      setError("Terlalu banyak percobaan gagal. Silakan reset password.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Tambah hitungan gagal
        setAttempts((prev) => prev + 1);
        setError("Email atau password salah");
      } else {
        // Reset hitungan jika sukses
        setAttempts(0);
        if (onSuccess) onSuccess();
        router.push(redirectTo);
      }
    } catch (err) {
      setError("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Cek apakah form terkunci
  const isLocked = attempts >= MAX_ATTEMPTS;

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white">Masuk ke Cipamingkis</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Masukkan email dan password</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {isLocked && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg mb-4 text-sm">
          <p className="font-medium">⚠️ Akun Anda untuk sementara dikunci karena terlalu banyak percobaan gagal.</p>
          <p className="mt-1">
            <a href="/forgot-password" className="underline font-semibold hover:text-yellow-800 dark:hover:text-yellow-200">
              Reset password sekarang
            </a>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLocked}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff] disabled:opacity-50 disabled:cursor-not-allowed"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff] disabled:opacity-50 disabled:cursor-not-allowed pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLocked}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
              tabIndex={-1}
            >
              <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || isLocked}
          className="w-full py-2.5 bg-[#00c8ff] text-white rounded-lg font-medium hover:bg-[#00c8ff]/90 disabled:opacity-50 transition-all shadow-lg shadow-[#00c8ff]/20"
        >
          {loading ? "Loading..." : "Masuk"}
        </button>
      </form>

      {/* Link Lupa Password */}
      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          <a href="/forgot-password" className="text-[#00c8ff] hover:underline">
            Lupa password?
          </a>
        </p>
      </div>
    </div>
  );
}