import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Clan | Private Admin Console",
  description: "Private super admin console for the Creative Clan AI Business Agent.",
  icons: { icon: "/favicon.webp", shortcut: "/favicon.webp" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}