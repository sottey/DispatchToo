import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const hasGitHub = !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight dark:text-white">Dispatch</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Sign in to continue</p>
        </div>
        {hasGitHub && (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Sign in with GitHub
            </button>
          </form>
        )}
        {isDev && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email") as string,
                redirectTo: "/",
              });
            }}
            className="space-y-3"
          >
            <input
              name="email"
              type="email"
              defaultValue="test@dispatch.local"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white"
              placeholder="Email"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              Dev Login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
