import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

/**
 * NextAuth configuration.
 *
 * Password and magic-link authentication are handled by our custom endpoints
 * (src/app/api/auth/*). Google OAuth is handled here via the Google provider.
 *
 * Invite-only policy: only users whose email already exists in the database
 * (status: active or invited) may sign in with Google. Unknown emails are
 * rejected. Invited users are automatically activated on first Google sign-in.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, user }) {
      // Only apply invite-only check for Google sign-ins.
      // Custom password/magic-link flows bypass this callback entirely.
      if (account?.provider !== "google") return true;

      const email = user.email;
      if (!email) return false;

      const dbUser = await db.user.findUnique({ where: { email } });

      // Reject emails not registered in the system
      if (!dbUser) return false;

      // Active users: allow immediately
      if (dbUser.status === "active") return true;

      // Invited users: activate their account on first Google sign-in
      // (Google has already verified the email, so this is safe)
      if (dbUser.status === "invited") {
        await db.user.update({
          where: { email },
          data: {
            status: "active",
            // Clear the invite token since the account is now active
            inviteToken: null,
            inviteTokenExpiry: null,
          },
        });
        return true;
      }

      // Pending users (created but not yet invited) cannot sign in
      return false;
    },

    async jwt({ token, account }) {
      // Populate token with DB user data on the initial Google sign-in.
      // On subsequent requests account is null, and the token already carries
      // the data from the first sign-in.
      if (account?.provider === "google" && token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.fullName;
        }
      }
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
