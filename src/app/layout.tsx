import type { Metadata } from "next";
import { Toaster } from "sonner";
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
        <Toaster
          richColors
          position="bottom-right"
          toastOptions={{
            style: { fontFamily: "Arial, Helvetica, sans-serif" },
            duration: 3500,
          }}
        />
      </body>
    </html>
  );
}
