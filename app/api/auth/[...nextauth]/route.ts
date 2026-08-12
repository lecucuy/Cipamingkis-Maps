import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          });
          const data = await res.json();
          if (res.ok && data.access_token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.full_name || data.user.email,
              role: data.user.role || "user",
              accessToken: data.access_token
            };
          }
          return null;
        } catch {
          return null;
        }
      }
    })
  ],
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.accessToken = user.accessToken; // dari authorize
      token.userId = user.id;
    }
    return token;
  },
  async session({ session, token }) {
    session.accessToken = token.accessToken; // <-- ini penting!
    session.user.id = token.userId;
    return session;
  }
},
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };