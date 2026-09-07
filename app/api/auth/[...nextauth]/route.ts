// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const secret = process.env.NEXTAUTH_SECRET;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          const data = await res.json();

          if (res.ok && data.access_token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.full_name || data.user.email,
              full_name: data.user.full_name,        // <-- TAMBAH
              role: data.user.role || "user",
              lat: data.user.lat,
              lon: data.user.lon,
              polygon: data.user.polygon,            // <-- TAMBAH (array koordinat)
              accessToken: data.access_token,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.full_name = user.full_name;       // <-- TAMBAH
        token.role = user.role;
        token.lat = user.lat;
        token.lon = user.lon;
        token.polygon = user.polygon;           // <-- TAMBAH
        token.accessToken = user.accessToken;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.full_name = token.full_name as string;   // <-- TAMBAH
        session.user.role = token.role as string;
        session.user.lat = token.lat as number;
        session.user.lon = token.lon as number;
        session.user.polygon = token.polygon as number[][];   // <-- TAMBAH
      }
      session.accessToken = token.accessToken as string;
      return session;
    },
  },

  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: secret || "fallback-secret",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };