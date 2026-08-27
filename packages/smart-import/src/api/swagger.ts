/**
 * OpenAPI / Swagger — SmartImport API.
 */
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "SmartImport API",
      version: "0.1.0",
      description:
        "API de importación segura de dispositivos, automations y sensor_data. Autenticación Bearer (Supabase JWT).",
      contact: { name: "AGENTEIA" },
    },
    servers: [
      { url: "http://localhost:3000", description: "Local" },
      { url: "/", description: "Current host" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
          },
        },
        ImportJob: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string" },
            targetTable: {
              type: "string",
              enum: ["devices", "automations", "sensor_data"],
            },
            status: {
              type: "string",
              enum: ["queued", "running", "completed", "failed"],
            },
            recordCount: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        HealthStatus: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["healthy", "degraded", "unhealthy"],
            },
            uptime: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": {
        get: {
          security: [],
          summary: "Health check",
          tags: ["Ops"],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthStatus" },
                },
              },
            },
            "503": { description: "Unhealthy" },
          },
        },
      },
      "/api/import/analyze": {
        post: {
          summary: "Analizar lote sin importar",
          tags: ["Import"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: {
                      type: "array",
                      items: { type: "object" },
                      minItems: 1,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Análisis" },
            "401": { description: "No autenticado" },
          },
        },
      },
      "/api/import/validate": {
        post: {
          summary: "Validar registros",
          tags: ["Import"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Resultado de validación" },
          },
        },
      },
      "/api/import/transform": {
        post: {
          summary: "Transformar / mapear campos",
          tags: ["Import"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { type: "array", items: { type: "object" } },
                    mapping: {
                      type: "object",
                      additionalProperties: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Datos transformados" },
          },
        },
      },
      "/api/import/execute": {
        post: {
          summary: "Ejecutar importación",
          tags: ["Import"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["targetTable", "data"],
                  properties: {
                    targetTable: {
                      type: "string",
                      enum: ["devices", "automations", "sensor_data"],
                    },
                    data: {
                      type: "array",
                      items: { type: "object" },
                      maxItems: 10000,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Import encolado/completado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      import: { $ref: "#/components/schemas/ImportJob" },
                    },
                  },
                },
              },
            },
            "400": { description: "Datos inválidos" },
            "401": { description: "No autenticado" },
            "403": { description: "Sin permiso" },
            "429": { description: "Rate limit" },
          },
        },
      },
      "/api/import/status/{importId}": {
        get: {
          summary: "Estado de una importación",
          tags: ["Import"],
          parameters: [
            {
              name: "importId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": { description: "Job" },
            "403": { description: "Forbidden" },
            "404": { description: "No encontrado" },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);

export function mountSwagger(app: Express): void {
  if (process.env.DISABLE_SWAGGER === "1") return;

  // JSON antes del UI (si no, swagger-ui captura /api/docs/*)
  app.get("/api/docs.json", (_req, res) => {
    res.json(swaggerSpec);
  });
  app.get("/api/docs/swagger.json", (_req, res) => {
    res.json(swaggerSpec);
  });
  app.get("/api/openapi.json", (_req, res) => {
    res.json(swaggerSpec);
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
