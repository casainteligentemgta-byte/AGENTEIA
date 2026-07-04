import { BrandLogoStack } from "@/components/app/brand-logo";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <BrandLogoStack theme="light" loading />
      <p className="absolute bottom-8 text-xs text-zinc-400">v0.2.0</p>
    </div>
  );
}
