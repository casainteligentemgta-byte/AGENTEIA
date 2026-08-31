import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEngineNosByVin,
  assignEngineNosByRowOrder,
  certHarvestNeedsMoreOcr,
  collectEngineNosInOrder,
  accumulateEngineNosSequentially,
  collectEngineNosFromColumnWords,
  firstUnusedEngineNo,
  harvestCertEnginesFromPages,
  harvestCertEnginesFromText,
  mergeCertEngineHarvests,
  orderPdfPageIndexesEngineFirst,
  parseCertEngineNosFromPages,
  parseCertEngineNosFromText,
  attachContainersFromText,
  extractPaisOrigenFromCertPages,
  extractPaisOrigenFromCertText,
  normalizeContainerNo,
} from "../cert-engine-text";

describe("parseCertEngineNosFromText", () => {
  it("empareja VIN + ENGINE No en la misma línea (página 2)", () => {
    const text = `
      LVVDC21B5VD713650 ENGINE NO: C16TD1234567
      LVVDB21B9VD812001 ENGINE NO C16TD7654321
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 2);
    assert.equal(pairs[0]?.vin, "LVVDC21B5VD713650");
    assert.equal(pairs[0]?.serialMotor, "C16TD1234567");
    assert.equal(pairs[1]?.serialMotor, "C16TD7654321");
  });

  it("alinea motores etiquetados con VIN si hay la misma cantidad", () => {
    const text = `
      Chassis: LVVDC21B5VD713650
      Chassis: LVVDB21B9VD812001
      ENGINE NO ABC12XY345
      ENGINE NO DEF98ZW765
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "ABC12XY345");
    assert.equal(byVin.LVVDB21B9VD812001, "DEF98ZW765");
  });

  it("no toma el VIN como motor", () => {
    const text = "LVVDC21B5VD713650 ENGINE NO LVVDC21B5VD713650";
    assert.equal(parseCertEngineNosFromText(text).length, 0);
  });

  it("lee columna ENGINE No con un encabezado y N seriales", () => {
    const text = `
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
      LVVDB21B9VD812001   C16TD98765432
      DESCRIPTION
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1234567");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
  });

  it("prioriza la página 2 (columna ENGINE No) frente a la carátula", () => {
    const page1 = `
      CERTIFICATE OF ORIGIN
      Consignee IKSAN MOTORS
      VIN LVVDC21B5VD713650
      VIN LVVDB21B9VD812001
    `;
    const page2 = `
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
      LVVDB21B9VD812001   C16TD98765432
    `;
    const pairs = parseCertEngineNosFromPages([page1, page2]);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1234567");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
  });

  it("asigna el primer ENGINE No huérfano bajo el encabezado al primer VIN", () => {
    const text = `
      VIN                 ENGINE NO
      SQRE4G15C1111111
      LVVDC21B5VD713650   NASDAQ SILVER
      LVVDB21B9VD812001   NASDAQ SILVER C16TD98765432
      LVVDB21B1VE033189   NASDAQ SILVER SQRE4T15C2408456
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 3);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1111111");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
    assert.equal(byVin.LVVDB21B1VE033189, "SQRE4T15C2408456");
  });

  it("toma el motor de la 1ª fila si OCR lo deja en la línea siguiente", () => {
    const text = `
      LVVDC21B5VD713650 NASDAQ SILVER
      SQRE4G15C1111111
      LVVDB21B9VD812001 NASDAQ SILVER C16TD98765432
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1111111");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
  });

  it("lista ENGINE No en orden aunque el VIN del COO no coincida", () => {
    const text = `
      ENGINE NO
      SQRE4G15C1111111
      C16TD2222222
      SQRE4T15C3333333
    `;
    assert.deepEqual(collectEngineNosInOrder(text), [
      "SQRE4G15C1111111",
      "C16TD2222222",
      "SQRE4T15C3333333",
    ]);
  });

  it("rellena motores vacíos por orden de fila (cruce VIN fallido)", () => {
    const rows = [
      { vin: "LVVDC21B5VD713650", serialMotor: "POR-COMPLETAR" },
      { vin: "LVVDB21B9VD812001", serialMotor: "" },
      { vin: "LVVDB21B1VE033189", serialMotor: "C16TD9999999" },
    ];
    const next = assignEngineNosByRowOrder(rows, [
      "SQRE4G15C1111111",
      "C16TD2222222",
      "C16TD9999999",
    ]);
    assert.equal(next[0]?.serialMotor, "SQRE4G15C1111111");
    assert.equal(next[1]?.serialMotor, "C16TD2222222");
    assert.equal(next[2]?.serialMotor, "C16TD9999999");
  });

  it("toma el motor tras color en la misma fila que el VIN", () => {
    const text = "LVVDC21B5VD713650 NASDAQ SILVER SQRE4G15C5556667";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]?.vin, "LVVDC21B5VD713650");
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15C5556667");
  });

  it("pisa un VIN copiado como motor de factura con ENGINE No del COO", () => {
    const rows = [
      {
        vin: "LVVDC21B5VD713650",
        serialCarroceria: "LVVDC21B5VD713650",
        serialMotor: "LVVDC21B5VD713650",
      },
      {
        vin: "LVVDB21B9VD812001",
        serialCarroceria: "LVVDB21B9VD812001",
        serialMotor: "POR-COMPLETAR",
      },
    ];
    const byVin = applyEngineNosByVin(rows, [
      { vin: "LVVDC21B5VD713650", serialMotor: "SQRE4G15CB0TC60412" },
      { vin: "LVVDB21B9VD812001", serialMotor: "SQRE4G15CB0TC60413" },
    ]);
    assert.equal(byVin[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(byVin[1]?.serialMotor, "SQRE4G15CB0TC60413");
    const byOrder = assignEngineNosByRowOrder(rows, [
      "SQRE4G15CB0TC60412",
      "SQRE4G15CB0TC60413",
      "SQRE4G15CB0TC60414",
      "SQRE4G15CB0TC60415",
      "SQRE4G15CB0TC60416",
      "SQRE4G15CB0TC60417",
      "SQRE4G15CB0TC60418",
      "SQRE4G15CB0TC60419",
    ]);
    assert.equal(byOrder[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(byOrder[1]?.serialMotor, "SQRE4G15CB0TC60413");
  });

  it("aplica ENGINE No y color del COO a las filas de factura", () => {
    const rows = [
      {
        vin: "LVVDC21B5VD713650",
        serialCarroceria: "LVVDC21B5VD713650",
        serialMotor: "POR-COMPLETAR",
        color: "",
      },
    ];
    const next = applyEngineNosByVin(rows, [
      {
        vin: "LVVDC21B5VD713650",
        serialMotor: "SQRE4G15C1234567",
        color: "WHITE",
      },
    ]);
    assert.equal(next[0]?.serialMotor, "SQRE4G15C1234567");
    assert.equal(next[0]?.color, "WHITE");
  });

  it("cruza ENGINE No del COO con VIN de factura (LWV vs LVV)", () => {
    const rows = [
      { vin: "LVVDB21B9VE033523", serialCarroceria: "LVVDB21B9VE033523", serialMotor: "" },
      { vin: "LVVDB2187VE033214", serialCarroceria: "LVVDB2187VE033214", serialMotor: "" },
    ];
    const next = applyEngineNosByVin(rows, [
      { vin: "LWVDB21B9VE033523", serialMotor: "SQRE4G15C1111111" },
      { vin: "LWVDB2187VE033214", serialMotor: "C16TD2222222" },
    ]);
    assert.equal(next[0]?.serialMotor, "SQRE4G15C1111111");
    assert.equal(next[1]?.serialMotor, "C16TD2222222");
  });

  it("cosecha pares y columna ENGINE No del mismo texto", () => {
    const harvested = harvestCertEnginesFromText(`
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
      LVVDB21B9VD812001   C16TD98765432
    `);
    assert.equal(harvested.pairs.length, 2);
    assert.deepEqual(harvested.motors, ["SQRE4G15C1234567", "C16TD98765432"]);
  });

  it("toma todos los VIN+SQRE de una sola línea OCR", () => {
    const text =
      "LVVDB21B9VE033523 SQRE4G15CB0TC60412 LVVDB21B1VE033189 SQRE4G15CB0TC60341 LVVDB21B9VE033215 SQRE4G15CB0TC60200";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 3);
    assert.equal(pairs[2]?.serialMotor, "SQRE4G15CB0TC60200");
  });

  it("no se salta filas por lastIndex de regex /g entre llamadas", () => {
    parseCertEngineNosFromText(`
      VIN ENGINE NO
      LVVDC21B5VD713650 SQRE4G15C1111111
      LVVDB21B9VD812001 C16TD98765432
    `);
    const text = `
      LVVDC21B5VD713650 NASDAQ SILVER
      SQRE4G15C1111111
      LVVDB21B9VD812001 NASDAQ SILVER C16TD98765432
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 2);
  });

  it("extrae los 8 ENGINE No fila por fila (COO Chery)", () => {
    const text = `
      ITEM VIN NO. ENGINE NO. COLOUR
      1 LVVDB21B9VE033523 SQRE4G15CB0TC60412 NASDAQ SILVER
      2 LVVDB21B1VE033189 SQRE4G15CB0TC60341 CELADON GRAY
      3 LVVDB21B9VE033215 SQRE4G15CB0TC60200 CELADON GRAY
      4 LVVDB21B5VE033213 SQRE4G15CB0TC60173 NASDAQ SILVER
      5 LVVDB21B9VE033214 SQRE4G15CB0TC60100 CELADON GRAY
      6 LVVDB21B8VE033212 SQRE4G15CB0TC60099 NASDAQ SILVER
      7 LVVDB21B7VE033211 SQRE4G15CB0TC60098 CELADON GRAY
      8 LVVDB21B6VE033210 SQRE4G15CB0TC60097 NASDAQ SILVER
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 8);
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(pairs[7]?.vin, "LVVDB21B6VE033210");
    assert.equal(pairs[7]?.serialMotor, "SQRE4G15CB0TC60097");
  });

  it("separa motores SQRE pegados y los alinea en orden", () => {
    const text =
      "LVVDB21B9VE033523 LVVDB21B1VE033189 SQRE4G15CB0TC60412SQRE4G15CB0TC60341";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 2);
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(pairs[1]?.serialMotor, "SQRE4G15CB0TC60341");
  });

  it("empareja VIN y SQRE4G15C en la misma fila (COO Chery pág. 2)", () => {
    const text = `
      ITEM VIN NO. ENGINE NO. COLOUR
      1 LVVDB21B9VE033523 SQRE4G15CB0TC60412 NASDAQ SILVER
      2 LVVDB21B1VE033189 SQRE4G15CB0TC60341 CELADON GRAY
      3 LVVDB21B9VE033215 SQRE4G15CB0TC60200 CELADON GRAY
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 3);
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(pairs[1]?.vin, "LVVDB21B1VE033189");
    assert.equal(pairs[1]?.serialMotor, "SQRE4G15CB0TC60341");
  });

  it("repara OCR S0RE → SQRE", () => {
    const pairs = parseCertEngineNosFromText(
      "LVVDB21B5VE033213 S0RE4G15CB0TC60173"
    );
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60173");
  });

  it("lee ENGINE No SQRF (Tiggo 7) en certificado de 1 página", () => {
    const page1 = `
      item DESCRIPCION VIN NO. ENGINE NO COLOUR
      1 TIGGO7 LVVDB21BXVD602983 SQRF4J16ELTC00007 PHANTOM GRAY
      2 TIGGO7 LVVDB21B1VD602967 SQRF4J16ELTD00083 KHAKI WHITE
      3 TIGGO8 LVTDB21B5VD010478 SQRF4J16ELTE00011 KHAKI WHITE
      4 Arrizo 5 Pro LVVDC21B5VD713650 SQRE4G15CALTD00083 NASDAQ SILVER
    `;
    const harvested = harvestCertEnginesFromPages([page1]);
    const byVin = Object.fromEntries(
      harvested.pairs.map((p) => [p.vin, p.serialMotor])
    );
    assert.equal(harvested.pairs.length, 4);
    assert.equal(byVin.LVVDB21BXVD602983, "SQRF4J16ELTC00007");
    assert.equal(byVin.LVVDB21B1VD602967, "SQRF4J16ELTD00083");
    assert.equal(byVin.LVTDB21B5VD010478, "SQRF4J16ELTE00011");
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15CALTD00083");
    assert.ok(harvested.motors.includes("SQRF4J16ELTC00007"));
  });

  it("repara OCR S0RF → SQRF", () => {
    const pairs = parseCertEngineNosFromText(
      "LVVDB21BXVD602983 S0RF4J16ELTC00007"
    );
    assert.equal(pairs[0]?.vin, "LVVDB21BXVD602983");
    assert.equal(pairs[0]?.serialMotor, "SQRF4J16ELTC00007");
  });

  it("lee los 8 ENGINE No de la columna desde cajas OCR (fila partida)", () => {
    const colX = 400;
    const rows = [
      ["SQRE4G15C", "B0TC60412"],
      ["SQRE4G15C", "B0TC60341"],
      ["SQRE4G15C", "B0TC60200"],
      ["SQRE4G15C", "B0TC60173"],
      ["SQRE4G15C", "B0TC60100"],
      ["SQRE4G15C", "B0TC60099"],
      ["SQRE4G15C", "B0TC60098"],
      ["SQRE4G15C", "B0TC60097"],
    ];
    const words = rows.flatMap((parts, i) => {
      const y = 40 + i * 28;
      return [
        { text: parts[0]!, x0: colX, y0: y, x1: colX + 90, y1: y + 16 },
        { text: parts[1]!, x0: colX + 92, y0: y, x1: colX + 190, y1: y + 16 },
      ];
    });
    const motors = collectEngineNosFromColumnWords(words);
    assert.equal(motors.length, 8);
    assert.equal(motors[0], "SQRE4G15CB0TC60412");
    assert.equal(motors[7], "SQRE4G15CB0TC60097");
  });

  it("pega el 2º ENGINE No al releer debajo del primero, y así", () => {
    const win1 = "LVVDB21B9VE033523 SQRE4G15CB0TC60412";
    const win2 = "SQRE4G15CB0TC60341 SQRE4G15CB0TC60200";
    const win3 = "SQRE4G15CB0TC60200";
    assert.equal(firstUnusedEngineNo(win1, []), "SQRE4G15CB0TC60412");
    assert.equal(
      firstUnusedEngineNo(win2, ["SQRE4G15CB0TC60412"]),
      "SQRE4G15CB0TC60341"
    );
    assert.deepEqual(accumulateEngineNosSequentially([win1, win2, win3]), [
      "SQRE4G15CB0TC60412",
      "SQRE4G15CB0TC60341",
      "SQRE4G15CB0TC60200",
    ]);
  });

  it("un solo ENGINE No no cierra la cosecha (hay que seguir la columna)", () => {
    const one = harvestCertEnginesFromText(
      "LVVDB21B9VE033523 SQRE4G15CB0TC60412"
    );
    assert.equal(one.pairs.length, 1);
    assert.equal(certHarvestNeedsMoreOcr(one), true);
    const rest = harvestCertEnginesFromText(`
      SQRE4G15CB0TC60341
      SQRE4G15CB0TC60200
      SQRE4G15CB0TC60173
    `);
    const merged = mergeCertEngineHarvests(one, rest);
    assert.equal(merged.motors.length, 4);
    assert.equal(certHarvestNeedsMoreOcr(merged), true);
  });

  it("8 ENGINE No cierran la cosecha extra de OCR", () => {
    const eight = harvestCertEnginesFromText(`
      SQRE4G15CB0TC60412
      SQRE4G15CB0TC60341
      SQRE4G15CB0TC60200
      SQRE4G15CB0TC60173
      SQRE4G15CB0TC60100
      SQRE4G15CB0TC60099
      SQRE4G15CB0TC60088
      SQRE4G15CB0TC60077
    `);
    assert.ok(eight.motors.length >= 8);
    assert.equal(certHarvestNeedsMoreOcr(eight), false);
  });

  it("lee el COO pág. 2 primero (flujo Extraer del lunes)", () => {
    assert.deepEqual(orderPdfPageIndexesEngineFirst(1), [0]);
    assert.deepEqual(orderPdfPageIndexesEngineFirst(2), [1, 0]);
    assert.deepEqual(orderPdfPageIndexesEngineFirst(3), [1, 0, 2]);
  });

  it("si la pág. 2 está vacía, busca ENGINE No en otra página", () => {
    const harvested = harvestCertEnginesFromPages([
      "CERTIFICATE OF ORIGIN",
      "",
      `
        VIN                 ENGINE NO
        LVVDC21B5VD713650   SQRE4G15C1234567
        LVVDB21B9VD812001   C16TD98765432
      `,
    ]);
    assert.equal(harvested.pairs.length, 2);
    assert.equal(harvested.pairs[0]?.serialMotor, "SQRE4G15C1234567");
  });
});

describe("contenedor ISO del certificado", () => {
  it("normaliza CONTAINER NO de 11 caracteres", () => {
    assert.equal(normalizeContainerNo("cmau-7117837"), "CMAU7117837");
    assert.equal(normalizeContainerNo("VIN LVVDB21B9VE033523"), null);
  });

  it("asigna el contenedor vigente a los VIN siguientes", () => {
    const text = `
      CONTAINER NO. CMAU7117837 SEAL M7304981
      LVVDB21B9VE033523 SQRE4G15CBDTC60412 NASDAQ SILVER
      LVVDB21B1VE033189 SQRE4G15CBDTC60341 CELADON GRAY
      CONTAINER NO. CMAU6237057 SEAL M7304982
      LVVDB21B8VE033514 SQRE4G15CBDTC60329 NASDAQ SILVER
      LVVDB21B5VE033180 SQRE4G15CBDTC60363 CELADON GRAY
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 4);
    assert.equal(pairs[0]?.contenedor, "CMAU7117837");
    assert.equal(pairs[1]?.contenedor, "CMAU7117837");
    assert.equal(pairs[2]?.contenedor, "CMAU6237057");
    assert.equal(pairs[3]?.contenedor, "CMAU6237057");
  });

  it("copia el contenedor a la fila por VIN", () => {
    const rows = applyEngineNosByVin(
      [
        {
          vin: "LVVDB21B9VE033523",
          serialCarroceria: "LVVDB21B9VE033523",
          serialMotor: "SQRE4G15CBDTC60412",
          numeroContenedor: "",
        },
      ],
      [
        {
          vin: "LVVDB21B9VE033523",
          serialMotor: "SQRE4G15CBDTC60412",
          contenedor: "CMAU7117837",
        },
      ]
    );
    assert.equal(rows[0]?.numeroContenedor, "CMAU7117837");
  });

  it("attachContainersFromText no pisa un contenedor ya leído", () => {
    const next = attachContainersFromText("CONTAINER NO ECMU7238132", [
      {
        vin: "LVVDB21B9VE033523",
        serialMotor: "SQRE4G15CBDTC60412",
        contenedor: "CMAU7117837",
      },
    ]);
    assert.equal(next[0]?.contenedor, "CMAU7117837");
  });
});

describe("extractPaisOrigenFromCertText", () => {
  it("lee COUNTRY OF ORIGIN: CHINA", () => {
    assert.equal(
      extractPaisOrigenFromCertText("CERTIFICATE OF ORIGIN\nCOUNTRY OF ORIGIN: CHINA"),
      "China"
    );
  });

  it("lee COUNTRY OF ORIGIN OF GOODS (factura / COO)", () => {
    assert.equal(
      extractPaisOrigenFromCertText(
        "DESTINATION: El Guamache COUNTRY OF ORIGIN OF GOODS: CHINA"
      ),
      "China"
    );
  });

  it("lee People's Republic of China / PRC junto a la etiqueta", () => {
    assert.equal(
      extractPaisOrigenFromCertText(
        "8. Country of origin\nTHE PEOPLE'S REPUBLIC OF CHINA"
      ),
      "China"
    );
    assert.equal(
      extractPaisOrigenFromCertText("COUNTRY OF ORIGIN: P.R.CHINA"),
      "China"
    );
    assert.equal(
      extractPaisOrigenFromCertText("COUNTRY OF ORIGIN PRC"),
      "China"
    );
  });

  it("lee PAÍS DE ORIGEN y Japón", () => {
    assert.equal(
      extractPaisOrigenFromCertText("PAÍS DE ORIGEN: Japón"),
      "Japón"
    );
    assert.equal(
      extractPaisOrigenFromCertText("COUNTRY OF ORIGIN: JAPAN"),
      "Japón"
    );
  });

  it("no inventa China si no hay etiqueta de origen", () => {
    assert.equal(
      extractPaisOrigenFromCertText(
        "CHERY AUTOMOBILE CO., LTD WUHU CHINA EXPORTER"
      ),
      null
    );
  });

  it("toma el país de la carátula, no de la tabla ENGINE No", () => {
    const page1 = `
      CERTIFICATE OF ORIGIN
      Consignee IKSAN MOTORS
      COUNTRY OF ORIGIN: CHINA
    `;
    const page2 = `
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
    `;
    assert.equal(extractPaisOrigenFromCertPages([page1, page2]), "China");
    assert.equal(extractPaisOrigenFromCertPages(["", page2]), null);
  });

  it("mergeCertEngineHarvests conserva paisOrigen", () => {
    const merged = mergeCertEngineHarvests(
      { pairs: [], motors: [], paisOrigen: "China" },
      {
        pairs: [
          { vin: "LVVDC21B5VD713650", serialMotor: "SQRE4G15C1234567" },
        ],
        motors: ["SQRE4G15C1234567"],
      }
    );
    assert.equal(merged.paisOrigen, "China");
    assert.equal(merged.pairs.length, 1);
  });
});
