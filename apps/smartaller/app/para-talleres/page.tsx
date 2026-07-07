import { Navbar } from "@/components/landing/navbar";
import { HowItWorks } from "@/components/landing/how-it-works";
import { B2bHero } from "@/components/landing/b2b-hero";
import { PlatformAbout } from "@/components/landing/platform-about";
import { B2bFeatures } from "@/components/landing/b2b-features";
import { B2bIndustries } from "@/components/landing/b2b-industries";
import { B2bFaq } from "@/components/landing/b2b-faq";
import { B2bCta } from "@/components/landing/b2b-cta";

export const metadata = {
  title: "Para talleres — SmartTaller",
  description:
    "Digitaliza tu taller con Telegram, IA y dashboard. Flota, repuestos, diagnóstico visual y app para tus clientes.",
};

export default function ParaTalleresPage() {
  return (
    <>
      <Navbar active="talleres" />
      <main>
        <B2bHero />
        <PlatformAbout />
        <B2bFeatures />
        <HowItWorks />
        <B2bIndustries />
        <B2bFaq />
        <B2bCta />
      </main>
      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-600">
        SmartTaller © {new Date().getFullYear()} — Plataforma para talleres y tiendas
      </footer>
    </>
  );
}
