import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMS v4",
  description: "Glossary-Aware Translation Application"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
