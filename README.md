# Booking backend

NestJS 11 authentication using PostgreSQL, Sequelize, bcrypt, Passport JWT, Joi configuration validation, and Swagger.

## Setup

Use Node.js 22.12 or newer (the installed Nest integration packages use ESM).

```sh
npm ci
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `JWT_SECRET` in `.env` to the generated value and supply your PostgreSQL connection settings. Create the database, then apply the schema once using a PostgreSQL connection with DDL permissions:

```sh
psql -h localhost -U postgres -d booking -v ON_ERROR_STOP=1 -f database/001-create-users.sql
npm run start:dev
```

The application does not automatically synchronize or alter database tables. Run migrations separately from the application and use a restricted database account for the running service.

## Authentication API

Swagger UI: `http://localhost:3000/docs`.

| Endpoint            | Input / authorization                                                            | Response                          |
| ------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| `POST /auth/signup` | `{ "name": "Alex", "email": "alex@example.com", "password": "secure-password" }` | 201: access token and public user |
| `POST /auth/login`  | `{ "email": "alex@example.com", "password": "secure-password" }`                 | 200: access token and public user |
| `GET /auth/me`      | `Authorization: Bearer <accessToken>`                                            | 200: `{ "id", "name", "email" }`  |

Signup and login return `{ accessToken, tokenType: "Bearer", expiresIn, user }`. Tokens default to 15 minutes; configure `JWT_ACCESS_TTL_SECONDS` between 60 and 86400 seconds. JWTs enforce HS256, issuer, audience, expiry, and a valid user subject. Deleted users cannot authenticate. Password hashes are excluded from default Sequelize queries and all API responses.

Emails are trimmed and lowercased. Names are trimmed. Passwords require at least eight characters and at most 72 UTF-8 bytes, avoiding bcrypt truncation. Unknown fields and invalid inputs return 400; duplicate emails return 409; invalid credentials or tokens return 401. Requests are limited globally to 10 per IP per minute (429). The in-memory throttle applies per process; use a shared throttle store for multiple instances. Configure trusted proxy handling deliberately if deploying behind a proxy.

To protect another controller or route, import `AuthModule` in its module and apply `@UseGuards(JwtAuthGuard)`. Passport places the public user profile on `request.user`.

Serve production traffic over HTTPS. There are no refresh tokens or logout revocation; access tokens remain valid until expiry unless the user is deleted or the signing secret is rotated.

## Verification

```sh
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Unit tests cover password hashing, credential failures, duplicate constraints, profile projection, claims validation, and request validation. HTTP tests exercise real JWT signing and Passport verification with mocked persistence; they require no PostgreSQL instance. Apply the SQL migration and verify database connectivity against your deployment database before deploying.
