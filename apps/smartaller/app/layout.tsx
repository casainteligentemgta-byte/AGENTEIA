import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getBrand } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const brand = getBrand();

export const metadata: Metadata = {
  title: brand.copy.metaTitle,
  description: brand.copy.metaDescription,
  manifest: "/manifest.json",
  icons: {
    icon: brand.assets.favicon,
    apple: brand.assets.appleIcon,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: brand.copy.appleWebAppTitle,
  },
};

export const viewport: Viewport = {
  themeColor: brand.theme.colors.themeColor,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-brand={brand.id} data-theme={brand.theme.mode}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
