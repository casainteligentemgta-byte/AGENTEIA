export default function CentrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 mx-auto max-w-lg overflow-hidden bg-zinc-100">
      {children}
    </div>
  );
}
