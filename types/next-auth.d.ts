// types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    full_name?: string;
    role: string;
    lat?: number;
    lon?: number;
    polygon?: number[][];      // <-- TAMBAHKAN
    accessToken?: string;
  }

  interface Session {
    accessToken?: string;
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string;
    role?: string;
    lat?: number;
    lon?: number;
    polygon?: number[][];      // <-- TAMBAHKAN
    full_name?: string;
  }
}