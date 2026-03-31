# 📄 Saveplan API - Swagger Documentation

## 📋 Table of Contents
- [Swagger Overview](#swagger-overview)
- [Implemented Modules (Swagger Documented)](#implemented-modules-swagger-documented)
  - [Auth Module](#auth-module)
  - [Contributions Module](#contributions-module)
  - [Payments Module](#payments-module)
  - [Dashboard & Analytics Module](#dashboard-analytics-module)
  - [Admin & Governance Module](#admin-governance-module)
- [Setup and Configuration](#setup-and-configuration)
- [Documenting Endpoints (JSDoc)](#documenting-endpoints-jsdoc)
- [Viewing the Documentation](#viewing-the-documentation)
- [Swagger UI Features](#swagger-ui-features)
- [Troubleshooting](#troubleshooting)
- [Adding New Modules](#adding-new-modules)

---

## Swagger Overview

This document explains how the Saveplan API uses Swagger (OpenAPI) to automatically generate interactive API documentation. The documentation is generated from JSDoc comments within the route files and a central configuration file.

**Key Benefits:**
- **Interactive UI:** Provides a user-friendly interface to visualize and interact with the API's resources.
- **Auto-generated:** Documentation is kept up-to-date with code changes by parsing JSDoc comments.
- **Testable Endpoints:** Allows direct testing of API endpoints from the browser.
- **Standardized:** Follows the OpenAPI 3.0 specification, making it easily consumable by other tools.

---

## Implemented Modules (Swagger Documented)

The following core API modules are planned for documentation via JSDoc comments in their respective route files. As the project is in its early stages, these will be populated as routes are implemented.

### Auth Module

#### JSDoc Tags Snippet
```typescript
/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user session management
 */
```

#### Overview
The Saveplan API uses JWT (JSON Web Tokens) for authentication. Registration requires a valid Invitation Code and OTP verification via Africa's Talking. The system uses a granular permission-based RBAC system.

#### Base Path
`/api/auth`

#### Illustrative Route JSDoc Snippet (`POST /register`)
```typescript
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new member with Invitation Code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - password
 *               - invitationCode
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 description: Primary M-Pesa Number
 *               password:
 *                 type: string
 *                 format: password
 *               invitationCode:
 *                 type: string
 *     responses:
 *       "201":
 *         description: User registered successfully, awaiting OTP verification.
 *       "400":
 *         description: Invalid input, duplicate user, or invalid invitation code.
 *       "500":
 *         description: Server error.
 */
```

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/register` | Register with Invitation Code |
| `POST` | `/verify-otp` | Verify phone ownership |
| `POST` | `/login` | User login |
| `POST` | `/forgot-password` | Request password recovery |
| `POST` | `/reset-password` | Update password |
| `GET` | `/me` | Current profile |

---

### Contributions Module

#### JSDoc Tags Snippet
```typescript
/**
 * @swagger
 * tags:
 *   name: Contributions
 *   description: Member savings and contribution management
 */
```

#### Overview
Contributions represent the member's ledger entries for savings. Each contribution is linked to a Payment transaction. Once a payment is successful, the contribution becomes read-only to ensure data integrity.

#### Base Path
`/api/contributions`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Start new contribution (triggers STK Push) |
| `GET` | `/history` | Personal contribution list |
| `GET` | `/all` | All group contributions (Treasurer only) |

---

### Payments Module

#### JSDoc Tags Snippet
```typescript
/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: M-Pesa transaction processing and callbacks
 */
```

#### Overview
Handles integration with M-Pesa Daraja API for STK Push (deposits) and B2C (payouts). It maintains a technical log of all transactions separate from the contribution ledger.

#### Base Path
`/api/payments`

#### Routes
| Method | Path | Description |
|---|---|---|
| `POST` | `/callback/stk` | Daraja STK Webhook |
| `POST` | `/callback/b2c` | Daraja B2C Webhook |
| `GET` | `/:id/status` | Query transaction status |

---

### Dashboard & Analytics Module

#### JSDoc Tags Snippet
```typescript
/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Role-based dashboards and savings analytics
 */
```

#### Overview
Provides aggregated data for members (personal totals) and admins (group totals, till balance, trends).

#### Base Path
`/api/stats`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard` | Role-based dashboard data |
| `GET` | `/analytics/trends` | Savings trends graphs |
| `GET` | `/analytics/participation` | Member participation metrics |

---

### Admin & Governance Module

#### JSDoc Tags Snippet
```typescript
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Treasurer and Chairman governance operations
 */
```

#### Overview
Covers sensitive operations like generating invitation codes, managing roles, and the "Double-Lock" payout process which requires Treasurer initiation and Chairman approval.

#### Base Path
`/api/admin`

#### Routes
| Method | Path | Description |
|---|---|---|
| `GET` | `/ledger` | Automated ledger of all verified transactions |
| `POST` | `/payout/initiate` | Treasurer starts payout process |
| `POST` | `/payout/approve` | Chairman final sign-off |
| `POST` | `/invite-codes` | Generate family codes |

---

## Setup and Configuration

Swagger documentation is configured in `src/config/swagger.ts`. This file defines the basic API information, server details, security schemes, and the paths where Swagger-JSdoc should look for API definitions.

**File: `src/config/swagger.ts`**
```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    // API metadata and global settings
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
    // Reusable components (e.g., security schemes, schemas)
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token in the format: Bearer <token>"
        }
      },
      schemas: {
        // Global schemas can be defined here if needed
      }
    },
    // Global tags for categorizing endpoints
    tags: [
      { name: "Auth", description: "Authentication and user session management" },
      { name: "Contributions", description: "Member savings and contribution management" },
      { name: "Payments", description: "M-Pesa transaction processing" },
      { name: "Stats", description: "Dashboards and analytics" },
      { name: "Admin", description: "Treasurer and Chairman governance" }
    ]
  },
  // Paths to files containing JSDoc comments for API definitions
  apis: ["./src/routes/*.ts"] // Scan all .ts files in the src/routes directory
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true, // Enable the explorer bar for filtering endpoints
    customCss: `
      .swagger-ui .topbar { display: none } // Hide Swagger UI top bar
      .swagger-ui .info .title { color: #10b981 }
      .swagger-ui .scheme-container { background: #f0fdf4 }
      .swagger-ui .info .description { font-size: 16px; color: #4b5563; }
    `,
    customSiteTitle: "Saveplan API Documentation"
  }
};

export default swaggerConfig;
```

The `apis` array is crucial as it tells `swagger-jsdoc` which files to parse for JSDoc comments containing OpenAPI definitions. For this project, all route definitions are expected to be in `src/routes/*.ts`.

---

## Documenting Endpoints (JSDoc)

API endpoints are documented using JSDoc comments directly above their route definitions in the `src/routes` directory. These comments follow the OpenAPI 3.0 specification and are parsed by `swagger-jsdoc` to build the API documentation.

### General Structure

```typescript
/**
 * @swagger
 * /api/your-path:
 *   method:
 *     summary: A short summary of the endpoint's purpose.
 *     tags: [YourTag]
 *     description: |
 *       A more detailed description of the endpoint.
 *       Use markdown for rich text.
 *     security:
 *       - bearerAuth: [] # If authentication is required
 *     parameters: # Path, query, or header parameters
 *       - in: path
 *         name: paramName
 *         schema:
 *           type: string
 *         required: true
 *         description: Description of the path parameter.
 *     requestBody: # For POST, PUT, PATCH requests
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *             example:
 *               field1: "value"
 *     responses:
 *       "200":
 *         description: Success response description.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { type: object }
 *             example:
 *               success: true
 *               message: "Operation successful"
 *               data: {}
 *       "401":
 *         description: Unauthorized.
 *       "500":
 *         description: Server error.
 */
router.method("/api/your-path", middleware, controllerFunction);
```

### Key JSDoc Keywords

-   `@swagger`: Marks the beginning of a Swagger/OpenAPI definition block.
-   `summary`: A brief summary of the operation.
-   `tags`: Used to group related operations in the UI. Must correspond to a tag defined in `src/config/swagger.ts`.
-   `description`: A more detailed explanation. Can use Markdown.
-   `security`: Defines authentication requirements. `bearerAuth: []` refers to the scheme defined in `swagger.ts`.
-   `parameters`: Defines path, query, header, or cookie parameters.
    -   `in`: Location of the parameter (`path`, `query`, `header`, `cookie`).
    -   `name`: Name of the parameter.
-   `requestBody`: Describes the payload for requests that send data (POST, PUT, PATCH).
-   `responses`: Describes possible responses for the operation, indexed by HTTP status code.

### Example: Documenting a `POST` Request

Consider a contribution creation route:

```typescript
/**
 * @swagger
 * /api/contributions:
 *   post:
 *     summary: Start a new contribution (triggers M-Pesa STK Push)
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The amount to contribute in KES.
 *               notes:
 *                 type: string
 *     responses:
 *       "201":
 *         description: Contribution initiated successfully.
 *       "400":
 *         description: Bad request due to invalid input.
 */
router.post("/", authenticateToken, initiateContribution);
```

---

## Viewing the Documentation

To view the generated Swagger documentation:

1.  **Ensure the API server is running.** You can start it in development mode:
    ```bash
    npm run dev
    ```
2.  **Open your web browser** and navigate to:
    ```
    http://localhost:4500/api/docs
    ```
    (Note: The port might vary if configured differently in your `.env` file. Check your server's startup logs for the exact port.)

You will see an interactive Swagger UI listing all documented endpoints, grouped by tags.

---

## Swagger UI Features

-   **Endpoint List:** All documented API endpoints are listed and grouped by tags.
-   **Expand/Collapse:** Click on an endpoint to expand its details, including parameters, request body, and responses.
-   **"Try it out" Button:** For each endpoint, you can click "Try it out" to send a request directly from the UI.
    -   Fill in the parameters and request body.
    -   If a `bearerAuth` security scheme is defined, you can click the "Authorize" button at the top right, enter your JWT token, and it will be included in subsequent requests.
    -   Click "Execute" to send the request and see the response directly in the UI.
-   **Schemas:** Data models (schemas) are displayed at the bottom of the page, defining the structure of request and response bodies.

---

## Troubleshooting

-   **"No operations defined in spec!"**:
    -   Ensure your API server is running.
    -   Verify that `src/config/swagger.ts`'s `apis` array correctly points to your route files (e.g., `./src/routes/*.ts`).
    -   Check that your JSDoc comments are correctly formatted and are placed directly above the `router.method(...)` calls.
-   **Routes not appearing/outdated**:
    -   Restart your API server after making changes to JSDoc comments or `swagger.ts`.
-   **Authentication issues ("Unauthorized")**:
    -   Ensure you have provided a valid JWT token in the "Authorize" dialog.
    -   Verify that your `authenticateToken` middleware is correctly applied.

---

## Adding New Modules

When adding a new module with new routes (e.g., `memberRoutes.ts`), follow these steps to integrate it into the Swagger documentation:

1.  **Create the Route File:** Add your new route definitions in `src/routes/yourNewModuleRoutes.ts`.
2.  **Update `swagger.ts` (Optional but Recommended):**
    *   Add a new tag to the `tags` array in `src/config/swagger.ts` for your new module.
    *   Ensure your route file is covered by the `apis` array.
3.  **Document Endpoints:** Add detailed JSDoc comments directly above each route definition.
4.  **Restart Server:** Restart your API server (`npm run dev`) to regenerate the Swagger documentation.
5.  **Verify:** Visit `http://localhost:4500/api/docs` to confirm your new module appears correctly.

---

**Last Updated:** March 2026
**Version:** 1.0.0
**Maintainer:** Saveplan API Development Team
