"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type NFCQRCodeProps = {
  url: string;
  size?: number;
  className?: string;
  label?: string;
};

export function NFCQRCode({ url, size = 220, className = "", label }: NFCQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: "#0a1628", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo generar el QR");
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (error) {
    return (
      <div className={`rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-200 ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <figure className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div
        className="overflow-hidden rounded-2xl border border-zinc-700 bg-white p-3 shadow-lg shadow-cyan-900/10"
        style={{ width: size + 24, height: size + 24 }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={label ?? "Código QR del sticker NFC"} width={size} height={size} />
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-zinc-200" />
        )}
      </div>
      {label ? <figcaption className="text-xs text-zinc-500">{label}</figcaption> : null}
    </figure>
  );
}
