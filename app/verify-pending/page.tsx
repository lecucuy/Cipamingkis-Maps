// app/verify-pending/page.tsx
export default function VerifyPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a1a] p-4">
      <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white">Cek Email Anda</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Kami telah mengirimkan link verifikasi ke <strong>email cadangan</strong> Anda. 
          Silakan buka email tersebut dan klik link untuk mengaktifkan akun.
        </p>
        <p className="text-gray-400 text-sm mt-4">Link verifikasi berlaku 24 jam.</p>
        <a href="/login" className="mt-6 inline-block text-[#00c8ff] hover:underline">Kembali ke Login</a>
      </div>
    </div>
  );
}