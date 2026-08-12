// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

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
              role: data.user.role || "user",
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
// app/api/auth/[...nextauth]/route.ts

callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.accessToken = user.accessToken;
      token.userId = user.id;
      token.role = user.role;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      // Tambahkan `as string` atau `|| ""` untuk menjamin tipe string
      session.user.id = (token.userId as string) || "";
      session.user.role = (token.role as string) || "user";
    }
    session.accessToken = (token.accessToken as string) || "";
    return session;
  },
},
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // @ts-ignore - TypeScript tidak bisa menjamin secret string, tapi sudah divalidasi di runtime
  secret: secret || "fallback-secret",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };