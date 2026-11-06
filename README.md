# Smart Home API (Node.js MVC Architecture)

MSHome is a smart-home platform backed by a Node.js and Express API. It manages parent and child accounts, phone verification via SMS OTP, protected device inventory, room filtering, device status control, and device-specific state such as brightness, temperature, and lock state.

The API serves two frontends: a vanilla HTML/CSS/JS web dashboard (deployed on Vercel) and an Expo / React Native mobile app. The API itself is deployed on Render.

## Architecture & Tech Stack

* **Backend:** Node.js and Express.
* **Database:** MongoDB Atlas (native driver; schemas are documented in `models/` and enforced with indexes).
* **SMS:** Twilio REST API for OTP delivery, with a console fallback in development.
* **Email:** Nodemailer + Gmail SMTP for the welcome notification, with a console fallback in development.
* **Design Patterns:** MVC boundaries, role-based access control, observer registry for device updates.
* **Security:** JWT authentication (no hardcoded fallback — the server refuses to start without `JWT_SECRET`), bcrypt password and OTP hashing, per-IP rate limiting on all auth routes, parent-only inventory routes, environment variables through `dotenv`.

## Features

* **Authentication:** Register with username, email, phone number, and password. Log in with username, **email, or phone number**.
* **Phone Verification (SMS OTP):** Identity is verified strictly by a 6-digit SMS code — hashed with bcrypt, valid for 10 minutes (MongoDB TTL index), maximum 5 attempts, 60-second resend cooldown. Email is required at registration but never verified.
* **Email Notification:** Async "Welcome" email on registration; a failed email never blocks the API response.
* **Family Access:** Parent accounts receive a family invite code; child accounts join with that code.
* **Role-Based Access:** Child accounts only see devices shared with them and cannot manage inventory.
* **Device Controls:** On/off, brightness, AC temperature, and door lock state.
* **Weather Widget:** Server-side proxy keeps the OpenWeatherMap API key private.

## Project Structure

```text
smart-home-node/
  config/db.js               MongoDB connection (single shared client)
  models/authModels.js       users / otp_verifications schemas + index setup (TTL, unique phone)
  controllers/
    authController.js        register, login (username/email/phone)
    otpController.js         send-otp, verify-otp
    deviceController.js      device CRUD, status, state, stats
  middleware/authMiddleware.js  JWT verification and parent-role check
  routes/
    authRoutes.js            public auth endpoints (rate limited)
    deviceRoutes.js          JWT-protected device endpoints
  services/
    smsService.js            OTP generation + Twilio SMS (console fallback in dev)
    emailService.js          Nodemailer welcome email (console fallback in dev)
    DeviceManager.js         observer registry for device status changes
  utils/phone.js             phone number normalization (shared format)
  server.js                  Express startup, CORS, rate limiting, index setup
```

## Environment Variables

Create a `.env` file in `smart-home-node/` with:

```bash
MONGO_URI="mongodb+srv://<username>:<password>@<your-cluster-address>/?retryWrites=true&w=majority"
JWT_SECRET="replace-with-a-long-random-secret"   # required: the server refuses to start without it
WEATHER_API_KEY="your-openweathermap-key"
PORT=3000

# Optional - email notifications (Gmail App Password).
# Leave empty in development: emails are logged to the console instead.
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Optional - SMS OTP via Twilio.
# Leave empty in development: the OTP is printed to the server console instead.
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

**Dev mode:** with the Twilio/Gmail variables empty, the full auth flow still works — OTP codes and emails are printed to the server console (on Render: the service Logs). Twilio trial accounts can only text numbers listed in Verified Caller IDs.

## Run The Project

```bash
cd smart-home-node
npm install
npm start
```

The API answers at `http://localhost:3000` (`GET /` returns a health message).

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Creates an account. Requires `name`, `email`, `phone_number`, `password`; optional `role` (`parent`/`child`) and `familyCode`. Sends the welcome email. |
| `POST` | `/auth/login` | Authenticates with `identifier` (username, email, or phone) + `password`. Returns a JWT. |
| `POST` | `/auth/send-otp` | Generates a 6-digit OTP for `phone_number`, stores it hashed with a TTL, and sends it via SMS. 60s resend cooldown. |
| `POST` | `/auth/verify-otp` | Verifies `phone_number` + `otp`, sets `is_phone_verified`, and returns a fresh JWT. Max 5 attempts per code. |
| `GET` | `/devices/types` | Returns supported device types. |
| `GET` | `/devices/` | Fetches devices visible to the current user. |
| `GET` | `/devices/stats` | Aggregated on/off device counts for the dashboard. |
| `POST` | `/devices/` | Creates a new device. Parent only. |
| `PUT` | `/devices/:id` | Updates device metadata. Parent only. |
| `PUT` | `/devices/:id/status` | Updates device on/off status. |
| `PUT` | `/devices/:id/state` | Updates nested device state fields. |
| `DELETE` | `/devices/:id` | Deletes a device. Parent only. |

All `/auth` routes are rate limited to 30 requests per 15 minutes per IP. All `/devices` routes require a `Authorization: Bearer <JWT>` header.
