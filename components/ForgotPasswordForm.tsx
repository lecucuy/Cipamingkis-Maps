// frontend/components/ForgotPasswordForm.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import PasswordInput from '@/components/PasswordInput';
import PasswordStrength, { evaluatePassword } from '@/components/PasswordStrength';

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/+$/, '');
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

export default function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');

  // Mode: jika ada tokenParam di URL, masuk ke mode 'reset', jika tidak 'request'
  const [token, setToken] = useState<string | null>(tokenParam);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // States
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string } | null>(null);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetCompleted, setResetCompleted] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Sync token from URL param
  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [tokenParam]);

  // Verifikasi token jika sedang di mode reset password
  const verifyToken = useCallback(async (t: string) => {
    setVerifyingToken(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/auth/verify-reset-token`, {
        params: { token: t },
      });
      if (res.data?.valid) {
        setTokenValid(true);
        setUserInfo({ name: res.data.name, email: res.data.email });
      } else {
        setTokenValid(false);
        setError('Token reset password tidak valid atau sudah kadaluwarsa.');
      }
    } catch (err: any) {
      setTokenValid(false);
      setError(err.response?.data?.detail || 'Token reset password tidak valid atau sudah kadaluwarsa.');
    } finally {
      setVerifyingToken(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setTokenValid(null);
    }
  }, [token, verifyToken]);

  // Countdown redirect setelah sukses reset
  useEffect(() => {
    if (!resetCompleted) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resetCompleted, router]);

  // Handler kirim link reset password
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Masukkan email Anda terlebih dahulu.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: trimmedEmail,
      });
      setSuccessMessage(
        res.data?.message ||
          'Instruksi reset password telah dikirim ke email Anda. Silakan cek kotak masuk atau folder spam.'
      );
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Gagal mengirim link reset password. Silakan coba beberapa saat lagi.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handler submit password baru
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Password baru tidak boleh kosong.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok dengan password baru.');
      return;
    }

    // Evaluasi kekuatan password
    const evalResult = evaluatePassword(newPassword);
    if (evalResult.score < 2) {
      setError('Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf, angka, atau simbol.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, {
        token,
        new_password: newPassword,
      });
      setResetCompleted(true);
      setSuccessMessage(res.data?.message || 'Password berhasil diperbarui!');
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Gagal memperbarui password. Token mungkin sudah kadaluwarsa.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl p-7 sm:p-8 border border-gray-100 dark:border-[#2a2a4e]/70 transition-all">
      {/* ===== HEADER ===== */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00c8ff]/10 text-[#00c8ff] mb-3 shadow-lg shadow-[#00c8ff]/10">
          <i className={`fa-solid ${token ? 'fa-key' : 'fa-lock'} text-2xl`}></i>
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white">
          {token ? 'Reset Kata Sandi' : 'Lupa Kata Sandi?'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1.5 max-w-xs mx-auto">
          {token
            ? 'Buat kata sandi baru yang kuat untuk mengamankan akun Anda.'
            : 'Masukkan email Anda dan kami akan mengirimkan link untuk mereset kata sandi.'}
        </p>
      </div>

      {/* ===== ERROR BANNER ===== */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-5 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn">
          <i className="fa-solid fa-circle-exclamation text-base shrink-0 mt-0.5"></i>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* KONDISI 1: MODE RESET PASSWORD SUKSES                    */}
      {/* ======================================================== */}
      {resetCompleted ? (
        <div className="text-center space-y-4 py-3 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-500 flex items-center justify-center mx-auto text-3xl">
            <i className="fa-solid fa-check"></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Password Berhasil Diperbarui!
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kata sandi Anda telah berhasil diganti. Mengalihkan ke halaman masuk dalam{' '}
              <span className="font-bold text-[#00c8ff]">{countdown}</span> detik...
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full py-2.5 bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-[#00c8ff]/25 cursor-pointer"
          >
            Masuk Sekarang
          </button>
        </div>
      ) : token ? (
        /* ======================================================== */
        /* KONDISI 2: MODE VERIFIKASI & FORM RESET PASSWORD         */
        /* ======================================================== */
        verifyingToken ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-[#00c8ff] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
              Memverifikasi token reset...
            </p>
          </div>
        ) : tokenValid === false ? (
          <div className="text-center space-y-4 py-4 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center mx-auto text-2xl">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                Tautan Tidak Valid atau Kadaluwarsa
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                Tautan reset password hanya berlaku selama 1 jam dan hanya dapat digunakan satu kali.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setToken(null);
                setError('');
                router.push('/forgot-password');
              }}
              className="w-full py-2.5 bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-white rounded-xl font-medium text-xs sm:text-sm transition-all shadow-lg shadow-[#00c8ff]/25 cursor-pointer"
            >
              Minta Tautan Reset Baru
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-fadeIn">
            {userInfo && (
              <div className="p-3 bg-gray-50 dark:bg-[#0f0f23] rounded-xl border border-gray-200 dark:border-[#2a2a4e] text-xs space-y-0.5">
                <p className="text-gray-500 dark:text-gray-400">Mereset akun untuk:</p>
                <p className="font-semibold text-gray-800 dark:text-white truncate">
                  {userInfo.name ? `${userInfo.name} (${userInfo.email})` : userInfo.email}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password Baru
              </label>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Minimal 8 karakter"
                required
                disabled={loading}
              />
              <div className="mt-2">
                <PasswordStrength password={newPassword} showChecklist={true} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Konfirmasi Password Baru
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Ulangi password baru"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-2.5 bg-[#00c8ff] hover:bg-[#00c8ff]/90 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-[#00c8ff]/25 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Password Baru</span>
              )}
            </button>
          </form>
        )
      ) : successMessage ? (
        /* ======================================================== */
        /* KONDISI 3: SUKSES KIRIM EMAIL RESET                      */
        /* ======================================================== */
        <div className="text-center space-y-4 py-3 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-[#00c8ff]/10 text-[#00c8ff] flex items-center justify-center mx-auto text-3xl shadow-lg shadow-[#00c8ff]/10">
            <i className="fa-solid fa-paper-plane animate-bounce"></i>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
              Link Reset Telah Dikirim!
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
              {successMessage}
            </p>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 rounded-xl text-[11px] text-sky-800 dark:text-sky-300 text-left">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <i className="fa-solid fa-circle-info"></i> Petunjuk:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-sky-700 dark:text-sky-400">
              <li>Cek folder <b>Spam</b> atau <b>Junk</b> jika tidak ada di Inbox.</li>
              <li>Jika menggunakan akun @cipamingkis.com, email dikirim ke <b>email cadangan</b> Anda.</li>
              <li>Link berlaku selama 1 jam.</li>
            </ul>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setSuccessMessage('');
                setEmail('');
              }}
              className="w-full py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-[#00c8ff] transition cursor-pointer"
            >
              Kirim ulang ke email lain
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-2.5 bg-gray-100 dark:bg-[#0f0f23] hover:bg-gray-200 dark:hover:bg-[#2a2a4e] text-gray-800 dark:text-white rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
            >
              Kembali ke Halaman Masuk
            </button>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* KONDISI 4: FORM REQUEST EMAIL RESET PASSWORD             */
        /* ======================================================== */
        <form onSubmit={handleRequestReset} className="space-y-4 animate-fadeIn">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Akun
            </label>
            <div className="relative">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@cipamingkis.com atau email cadangan"
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-gray-300 dark:border-[#2a2a4e] bg-white dark:bg-[#0f0f23] text-sm text-[#1a1a2e] dark:text-white focus:outline-none focus:border-[#00c8ff] focus:ring-2 focus:ring-[#00c8ff]/20 transition-all"
                required
                disabled={loading}
              />
              <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
              Bisa menggunakan email @cipamingkis.com atau email cadangan (Gmail/Yahoo dsb) yang didaftarkan.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-[#00c8ff] to-blue-600 hover:from-[#00b0e0] hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-[#00c8ff]/25 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Mengirim Link...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>Kirim Link Reset Password</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ===== FOOTER LINKS ===== */}
      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-[#2a2a4e]/70 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          Sudah ingat password?{' '}
          <a href="/login" className="text-[#00c8ff] hover:underline font-medium">
            Masuk di sini
          </a>
        </p>
      </div>
    </div>
  );
}
