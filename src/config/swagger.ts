import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Saveplan API",
      version: "1.0.0",
      description: "Family savings platform backend with M-Pesa integration",
      contact: { name: "Saveplan Support", email: "support@saveplan.com" },
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" }
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production"
            ? process.env.API_BASE_URL || "https://api.saveplan.com"
            : `http://localhost:${process.env.PORT || 4500}`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token in the format: Bearer <token>"
        }
      }
    },
    tags: [
      { name: "Auth", description: "Authentication and user session management" },
      { name: "Users", description: "Family member profile management" },
      { name: "Contributions", description: "Member savings and contribution management" },
      { name: "Payments", description: "M-Pesa transaction processing" },
      { name: "Stats", description: "Dashboards and analytics" },
      { name: "Admin", description: "Treasurer and Chairman governance" }
    ]
  },
  apis: ["./src/routes/*.ts"]
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #10b981 }
      .swagger-ui .scheme-container { background: #f0fdf4 }
      .swagger-ui .info .description { font-size: 16px; color: #4b5563; }
    `,
    customSiteTitle: "Saveplan API Documentation"
  }
};

export default swaggerConfig;
