# Week 4 — Frontend Authentication Testing

## Environment

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB Atlas
- Browser: Chrome
- Frontend URL: http://localhost:5173
- Backend URL: http://localhost:5000

## Test Cases

### 1. Register a new user

**Steps**

1. Open `/register`.
2. Enter a new name, email, and password.
3. Click **Create account**.

**Expected Result**

- User account is created.
- JWT is saved in localStorage.
- User is redirected to `/dashboard`.
- User information appears on the dashboard.

**Status:** Passed

---

### 2. Register with an existing email

**Steps**

1. Open `/register`.
2. Enter an email that already exists.
3. Submit the form.

**Expected Result**

- Registration is rejected.
- Backend error message appears.
- User remains on the registration page.

**Status:** Passed

---

### 3. Login with valid credentials

**Steps**

1. Open `/login`.
2. Enter valid credentials.
3. Click **Login**.

**Expected Result**

- JWT is saved in localStorage.
- User is redirected to `/dashboard`.
- Dashboard displays the logged-in user.

**Status:** Passed

---

### 4. Login with invalid credentials

**Steps**

1. Open `/login`.
2. Enter an incorrect password.
3. Submit the form.

**Expected Result**

- Login is rejected.
- Error message appears.
- No JWT is stored.
- User remains on `/login`.

**Status:** Passed

---

### 5. Restore session after refresh

**Steps**

1. Login successfully.
2. Open `/dashboard`.
3. Refresh the browser.

**Expected Result**

- Loading screen appears briefly.
- `/auth/me` validates the saved JWT.
- Dashboard remains visible.

**Status:** Passed

---

### 6. Protect dashboard route

**Steps**

1. Logout.
2. Manually open `/dashboard`.

**Expected Result**

- User is redirected to `/login`.

**Status:** Passed

---

### 7. Redirect authenticated users

**Steps**

1. Login successfully.
2. Manually open `/login` or `/register`.

**Expected Result**

- User is redirected to `/dashboard`.

**Status:** Passed

---

### 8. Logout

**Steps**

1. Login successfully.
2. Click **Logout**.
3. Refresh the browser.

**Expected Result**

- JWT is removed from localStorage.
- User is redirected to `/login`.
- Refreshing does not restore the session.

**Status:** Passed

---

### 9. Login and register navigation

**Steps**

1. Open `/login`.
2. Click **Create account**.
3. Click **Login** from the registration page.

**Expected Result**

- Links change between `/login` and `/register`.
- No full browser page reload occurs.

**Status:** Passed

## Final Result

**Week 4 Frontend Authentication:** Passed