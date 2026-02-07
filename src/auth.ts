import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

const providers = [];

// Only add GitHub if credentials are configured
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
}

// Dev-only credentials provider for local testing
if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "test@dispatch.local" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        if (!email) return null;

        // Find or create the user
        let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) {
          const id = crypto.randomUUID();
          await db.insert(users).values({ id, email, name: email.split("@")[0] });
          [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        }

        return user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers,
  session: {
    strategy: providers.some((p) => p === GitHub) ? "database" : "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
