import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Dispatch",
  description: "Personal dispatch and task management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
