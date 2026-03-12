import NextAuth from "next-auth";

/**
 * Minimal NextAuth configuration.
 *
 * Authentication for API routes is handled by our custom middleware
 * (src/middleware.ts) and endpoints (src/app/api/auth/*).
 *
 * The `auth()` helper exported here can be used in Server Components
 * and page route handlers to read the active session.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [],
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
