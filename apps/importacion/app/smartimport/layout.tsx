import type { ReactNode } from "react";

/** Shell mínimo del módulo; el gate de auth vive en `(modulo)/layout`. */
export default function ImportacionRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="smartimport-typography">{children}</div>;
}
