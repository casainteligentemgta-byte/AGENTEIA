import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import {
  Benefits,
  Closing,
  Footer,
  Header,
  Hero,
  ProofMetrics,
  Steps,
} from "@/components/landing/home";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartTaller · Una foto a la placa. El resto lo hace SmartTaller.",
  description:
    "La IA reconoce el vehículo, abre la orden y le avisa al cliente por WhatsApp. Gestión de talleres para autos, motos, bicis y maquinaria.",
};

export default function HomePage() {
  return (
    <div
      className={`${figtree.variable} ${bricolage.variable} landing-focus-scope min-h-screen bg-landing-bg pb-[env(safe-area-inset-bottom,0px)] font-landing-body text-base leading-[1.55] text-landing-text antialiased [scroll-padding-top:80px]`}
    >
      <Header />
      {/* overflow-x en un hijo: si va en el mismo contenedor que el header, rompe position:sticky */}
      <div className="overflow-x-hidden">
        <main id="inicio">
          <Hero />
          <ProofMetrics />
          <Steps />
          <Benefits />
          <Closing />
        </main>
        <Footer />
      </div>
    </div>
  );
}
