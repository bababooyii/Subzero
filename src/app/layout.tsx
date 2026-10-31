import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AgentationToolbar } from "@/components/dev/agentation-toolbar";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brightloop",
  description: "Subscription and billing back office for Brightloop Software.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
        <AgentationToolbar />
      </body>
    </html>
  );
}
