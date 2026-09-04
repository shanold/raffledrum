import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raffle Drum",
  description: "Tumble every name, then draw one fair winner.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
