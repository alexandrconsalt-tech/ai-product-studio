import type { Metadata } from "next";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Product Studio",
  description: "Профессиональная IDE для AI Product Manager",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
