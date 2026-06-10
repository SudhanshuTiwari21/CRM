import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { isAuthDisabled } from "@/lib/auth-bypass";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Book to Roam CRM",
  description: "Book to Roam — travel CRM for flights, hotels, and buses",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = isAuthDisabled() ? await auth() : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
