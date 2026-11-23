import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { getBrand } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});
const brand = getBrand();
const isJac = brand.id === "jac";

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
    statusBarStyle: isJac ? "default" : "black-translucent",
    title: brand.copy.appleWebAppTitle,
  },
};

export const viewport: Viewport = {
  themeColor: brand.theme.colors.themeColor,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-brand={brand.id}
      data-theme={brand.theme.mode}
      className={isJac ? jakarta.variable : undefined}
    >
      <body className={isJac ? jakarta.className : inter.className}>{children}</body>
    </html>
  );
}
