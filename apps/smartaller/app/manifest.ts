import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrand();
  return {
    name: brand.copy.pwaName,
    short_name: brand.copy.pwaShortName,
    description: brand.copy.pwaDescription,
    start_url: "/app",
    display: "standalone",
    background_color: brand.id === "jac" ? "#000000" : "#09090b",
    theme_color: brand.theme.colors.themeColor,
    lang: "es",
    orientation: "portrait-primary",
    icons: [
      {
        src: brand.assets.favicon,
        sizes: "any",
        type: brand.assets.favicon.endsWith(".svg") ? "image/svg+xml" : "image/png",
        purpose: "any",
      },
    ],
  };
}
