// types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    lat?: number;          // <-- TAMBAH
    lon?: number;          // <-- TAMBAH
    accessToken?: string;
  }

  interface Session {
    accessToken?: string;
    user: User;            // <-- Langsung pake User, bukan inline
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string;
    role?: string;
    lat?: number;          // <-- TAMBAH
    lon?: number;          // <-- TAMBAH
  }
}