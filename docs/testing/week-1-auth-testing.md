# Week 1 Authentication Testing

## Feature tested

NovaHub user authentication backend.

---

## Purpose

The purpose of this test is to confirm that users can:

```text
Register
Login
Receive JWT token
Access protected routes
Use validation safely
```

The authentication system should protect private user data and should never return passwords in API responses.

---

## Backend features involved

```text
Express backend
MongoDB connection
User model
Register API
Login API
JWT token generation
Password hashing with bcrypt
Protected route middleware
Auth validation middleware
```

---

## APIs tested

| Method | API | Purpose |
|---|---|---|
| GET | `/` | Check backend server |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get logged-in user |

---

# Test 1: Backend server health check

## Request

```http
GET http://localhost:5000
```

## Expected result

```text
NovaHub API is running
```

## Status

```text
Passed
```

---

# Test 2: Register new user

## Request

```http
POST http://localhost:5000/api/auth/register
```

## Body

```json
{
  "name": "Test User",
  "email": "testuser@gmail.com",
  "password": "Test123456"
}
```

## Expected result

```text
201 Created
User registered successfully
JWT token returned
User data returned without password
Password saved as hashed value in MongoDB
```

## Status

```text
Passed
```

---

# Test 3: Prevent duplicate registration

## Request

```http
POST http://localhost:5000/api/auth/register
```

## Body

Use the same email again:

```json
{
  "name": "Test User",
  "email": "testuser@gmail.com",
  "password": "Test123456"
}
```

## Expected result

```text
400 Bad Request
User already exists
```

## Status

```text
Passed
```

---

# Test 4: Register validation

## Request

```http
POST http://localhost:5000/api/auth/register
```

## Invalid body example

```json
{
  "name": "A",
  "email": "wrong-email",
  "password": "123"
}
```

## Expected result

```text
400 Bad Request
Validation failed
Name must contain at least 2 characters
Please provide a valid email address
Password must contain at least 6 characters
```

## Status

```text
Passed
```

---

# Test 5: Login user

## Request

```http
POST http://localhost:5000/api/auth/login
```

## Body

```json
{
  "email": "testuser@gmail.com",
  "password": "Test123456"
}
```

## Expected result

```text
200 OK
Login successful
JWT token returned
User data returned without password
```

## Status

```text
Passed
```

---

# Test 6: Login with wrong password

## Request

```http
POST http://localhost:5000/api/auth/login
```

## Body

```json
{
  "email": "testuser@gmail.com",
  "password": "wrongpassword"
}
```

## Expected result

```text
401 Unauthorized
Invalid email or password
```

## Status

```text
Passed
```

---

# Test 7: Login validation

## Request

```http
POST http://localhost:5000/api/auth/login
```

## Invalid body example

```json
{
  "email": "wrong-email",
  "password": ""
}
```

## Expected result

```text
400 Bad Request
Validation failed
```

## Status

```text
Passed
```

---

# Test 8: Access protected route with token

## Request

```http
GET http://localhost:5000/api/auth/me
```

## Authorization

```text
Bearer Token
```

Use the JWT token from login.

## Expected result

```text
200 OK
Logged-in user data returned
Password is not returned
```

## Status

```text
Passed
```

---

# Test 9: Access protected route without token

## Request

```http
GET http://localhost:5000/api/auth/me
```

## Authorization

No token.

## Expected result

```text
401 Unauthorized
Not authorized. Token is required.
```

## Status

```text
Passed
```

---

# Test 10: Access protected route with invalid token

## Request

```http
GET http://localhost:5000/api/auth/me
```

## Authorization

Use an invalid token.

## Expected result

```text
401 Unauthorized
Not authorized. Token is invalid or expired.
```

## Status

```text
Passed
```

---

# Security checks

```text
Passwords are hashed using bcrypt
JWT secret is stored in .env
.env is ignored by Git
Password is never returned in API responses
Protected routes require valid JWT token
Invalid or expired tokens are rejected
Validation prevents bad register/login input
```

---

# Week 1 result

```text
Authentication backend completed and tested successfully.
```