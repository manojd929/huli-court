import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { APP_NAME } from "@/constants/app";
import { APP_THEME_STORAGE_KEY } from "@/constants/theme-storage";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Run drafts, random team assignment, or a live IPL-style auction for your racquet-sports club — badminton, pickleball, tennis, table tennis — then run the whole tournament on a shared live board.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(APP_THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var r=document.documentElement;r.classList.remove("light","dark");var d;if(s==="light")d=!1;else if(s==="dark")d=!0;else if(s==="system")d=window.matchMedia("(prefers-color-scheme: dark)").matches;else d=!0;if(d)r.classList.add("dark");}catch(e){document.documentElement.classList.remove("light","dark");document.documentElement.classList.add("dark");}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
