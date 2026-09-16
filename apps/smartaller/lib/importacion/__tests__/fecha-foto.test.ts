import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractImageCaptureDate,
  formatFechaFotoInspeccion,
} from "@/lib/importacion/fecha-foto";

function buildMinimalJpegWithExifDate(dateStr: string): Uint8Array {
  // Minimal JPEG: SOI + APP1(EXIF) + SOS stub is complex; build a tiny APP1 with IFD.
  // SOI
  const exifHeader = [
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1
  ];

  // We'll assemble EXIF payload then wrap with size.
  const ascii = Array.from(`${dateStr}\0`).map((c) =>
    typeof c === "string" ? c.charCodeAt(0) : c
  );

  // TIFF little-endian
  // Offset 0: II 2A 0000 08 0000 (IFD at 8)
  // IFD0: 1 entry — DateTime (0x0132) type ASCII count=20 value offset
  const tiff: number[] = [];
  // "II"
  tiff.push(0x49, 0x49);
  // 42
  tiff.push(0x2a, 0x00);
  // IFD0 offset = 8
  tiff.push(0x08, 0x00, 0x00, 0x00);
  // entry count = 1
  tiff.push(0x01, 0x00);
  // tag DateTime 0x0132
  tiff.push(0x32, 0x01);
  // type ASCII = 2
  tiff.push(0x02, 0x00);
  // count = ascii.length
  const count = ascii.length;
  tiff.push(count & 0xff, (count >> 8) & 0xff, 0x00, 0x00);
  // value offset relative to TIFF start: after IFD header+entry+next = 8+2+12+4 = 26
  tiff.push(0x1a, 0x00, 0x00, 0x00);
  // next IFD = 0
  tiff.push(0x00, 0x00, 0x00, 0x00);
  // ascii at offset 26
  tiff.push(...ascii);

  const exifBody = [
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    ...tiff,
  ];
  const app1Size = exifBody.length + 2; // includes size bytes
  const bytes = [
    ...exifHeader,
    (app1Size >> 8) & 0xff,
    app1Size & 0xff,
    ...exifBody,
    0xff,
    0xd9, // EOI
  ];
  return new Uint8Array(bytes);
}

describe("fecha-foto", () => {
  it("lee DateTime desde EXIF JPEG", async () => {
    const buf = buildMinimalJpegWithExifDate("2024:03:15 10:30:00");
    const file = new File([buf], "frontal.jpg", { type: "image/jpeg" });
    const iso = await extractImageCaptureDate(file);
    assert.ok(iso);
    assert.equal(iso.slice(0, 10), "2024-03-15");
  });

  it("usa lastModified si no hay EXIF", async () => {
    const when = new Date("2025-06-01T15:00:00Z").getTime();
    const file = new File([new Uint8Array([1, 2, 3])], "x.png", {
      type: "image/png",
      lastModified: when,
    });
    const iso = await extractImageCaptureDate(file);
    assert.equal(iso, new Date(when).toISOString());
  });

  it("formatea fecha en es-VE", () => {
    const label = formatFechaFotoInspeccion("2024-03-15");
    assert.ok(label);
    assert.match(label!, /2024/);
    assert.match(label!, /15/);
  });
});
