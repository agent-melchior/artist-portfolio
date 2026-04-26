import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Artist Portfolio Prototype",
  description: "Minimal artist portfolio with horizontal gallery and admin backend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
