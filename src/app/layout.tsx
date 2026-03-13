import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RIO Task",
  description: "Project Management Board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
