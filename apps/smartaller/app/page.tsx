import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CTA } from "@/components/landing/cta";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <CTA />
      </main>
      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-600">
        SmartTaller © {new Date().getFullYear()} — Hecho para talleres mecánicos
      </footer>
    </>
  );
}
