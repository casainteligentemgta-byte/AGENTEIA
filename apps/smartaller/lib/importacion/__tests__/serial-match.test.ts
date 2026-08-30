import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchSerialKeyAmong,
  pairSerialsOneToOne,
  pickCertFileForSerial,
} from "../serial-match";

describe("matchSerialKeyAmong", () => {
  it("empareja VIN exacto y repara WMI Chery LWV→LVV", () => {
    assert.equal(
      matchSerialKeyAmong("LWVDC21B5VD713650", ["LVVDC21B5VD713650"]),
      "LVVDC21B5VD713650"
    );
  });

  it("empareja por prefijo único si el OCR recortó el VIN", () => {
    assert.equal(
      matchSerialKeyAmong("LVVDC21B5VD", [
        "LVVDC21B5VD713650",
        "LVVDB21B9VD812001",
      ]),
      "LVVDC21B5VD713650"
    );
  });

  it("empareja por sufijo único (últimos 8) sin confundir lotes", () => {
    assert.equal(
      matchSerialKeyAmong("XXXXC21B5VD713650", [
        "LVVDC21B5VD713650",
        "LVVDB21B9VD812001",
      ]),
      "LVVDC21B5VD713650"
    );
  });

  it("no empareja sufijo si hay dos VIN con el mismo final", () => {
    assert.equal(
      matchSerialKeyAmong("AAADC21B5VD713650", [
        "LVVDC21B5VD713650",
        "ZZZDC21B5VD713650",
      ]),
      null
    );
  });
});

describe("pairSerialsOneToOne", () => {
  it("empareja 1:1 y no reutiliza un certificado", () => {
    const paired = pairSerialsOneToOne(
      ["LVVDC21B5VD713650", "LVVDB21B9VD812001"],
      ["LVVDC21B5VD713650", "LVVDB21B9VD812001"]
    );
    assert.equal(paired.get("LVVDC21B5VD713650"), "LVVDC21B5VD713650");
    assert.equal(paired.get("LVVDB21B9VD812001"), "LVVDB21B9VD812001");
  });

  it("completa fila recortada con VIN de 17 del certificado", () => {
    const paired = pairSerialsOneToOne(
      ["LVVDC21B5VD713"],
      ["LVVDC21B5VD713650", "LVVDB21B9VD812001"]
    );
    assert.equal(paired.get("LVVDC21B5VD713"), "LVVDC21B5VD713650");
  });
});

describe("pickCertFileForSerial", () => {
  const files = [
    { name: "COO-LVVDC21B5VD713650.pdf" },
    { name: "cert-unidad-2.pdf" },
  ];

  it("usa el VIN completo en el nombre de archivo", () => {
    const hit = pickCertFileForSerial("LVVDC21B5VD713650", files);
    assert.equal(hit?.name, "COO-LVVDC21B5VD713650.pdf");
  });

  it("usa matches OCR serial↔fileName", () => {
    const hit = pickCertFileForSerial("LVVDB21B9VD812001", files, [
      { serial: "LVVDB21B9VD812001", fileName: "cert-unidad-2.pdf" },
    ]);
    assert.equal(hit?.name, "cert-unidad-2.pdf");
  });

  it("no adjunta el archivo equivocado por últimos 6 si hay ambigüedad", () => {
    const ambiguous = [
      { name: "doc-13650-a.pdf" },
      { name: "doc-13650-b.pdf" },
    ];
    assert.equal(pickCertFileForSerial("LVVDC21B5VD713650", ambiguous), null);
  });
});
