import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NavBar } from "@/components/nav/NavBar";
import { Footer } from "@/components/nav/Footer";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "devdash — AI-Powered Project & Task Management",
  description:
    "Real authentication, real projects and tasks, and one AI feature that actually works — see where every project stands, at a glance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-text-primary">
        <AuthProvider>
          <NavBar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
