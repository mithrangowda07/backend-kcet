# Setup & Admin Management Guide

## 1. Fix Category List Not Showing

The categories need to be seeded into MongoDB first.

### Run the seeding script:

```bash
npm run seed:categories
```

**What it does:**
- ✅ Connects to MongoDB (uses `MONGODB_URI` from `.env`)
- ✅ Clears any existing categories
- ✅ Seeds all 24 KCET categories (1R, 1K, 1G, 2AR, 2AK, 2AG, 2BR, 2BK, 2BG, 3AK, 3AR, 3AG, 3BK, 3BR, 3BG, STK, STR, STG, SCK, SCR, SCG, GMR, GMK, GM)

**Output example:**
```
🔗 Connecting to MongoDB...
✅ Connected to MongoDB
➕ Seeding 24 categories...
✅ Successfully seeded 24 categories!

📋 Seeded categories:
   • 1R (fallback: 1R,1G,GM)
   • 1K (fallback: 1K,1G,GM)
   ...
🔌 Disconnected from MongoDB
```

---

## 2. Create/Update Admin Accounts (Node.js Compatible)

The old admin passwords from Python/Django need to be replaced with Node.js bcrypt hashing.

### Create a new admin account:

```bash
npm run admin:create admin@example.com mypassword123 "Admin Name"
```

**Arguments:**
1. **Email** (required): Admin email address
2. **Password** (required): Admin password (minimum recommended: 8 characters)
3. **Name** (optional): Admin display name (defaults to "Admin")

### Examples:

**Create a new admin:**
```bash
npm run admin:create admin@college.com SuperSecure@123 "College Administrator"
```

**Update existing admin (same email):**
```bash
npm run admin:create admin@college.com NewPassword456 "Updated Admin"
```

### Output example:

```
✅ Connected to MongoDB
➕ Creating new admin account for: admin@college.com
✅ Admin account created successfully!
   Email: admin@college.com
   Name: College Administrator
   Active: true
   Created: 2026-06-02T10:30:45.123Z
🔌 Disconnected from MongoDB
```

---

## 3. How to Use the New Admin Account

### Admin Login Endpoint:
```
POST /api/admin/login/
Content-Type: application/json

{
  "email": "admin@college.com",
  "password": "SuperSecure@123"
}
```

### Response:
```json
{
  "admin": {
    "_id": "...",
    "email": "admin@college.com",
    "name": "College Administrator",
    "is_active": true,
    "created_at": "2026-06-02T10:30:45.123Z"
  },
  "tokens": {
    "access": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 4. Password Hashing Details

### What Changed:
- **Old (Python/Django):** Used `pbkdf2_sha256` hashing
- **New (Node.js):** Uses `bcryptjs` with salt rounds = 10

### Backward Compatibility:
✅ The backend can still verify old Django pbkdf2_sha256 passwords! The `verifyPassword()` function automatically detects and validates both:
- Django pbkdf2_sha256 hashes (starts with `pbkdf2_sha256$`)
- Modern bcrypt hashes

### Migration Path:
1. **Old admins:** Can still log in with their Django hashes (read-only, no breaking changes)
2. **New admins:** Created with Node.js bcrypt using the script
3. **Update old admin:** Re-run the script with the same email to update the password hash to bcrypt

---

## 5. Environment Variables

Ensure your `.env` file has:
```env
MONGODB_URI=mongodb://localhost:27017/database_name
```

---

## Quick Checklist ✓

- [ ] Seed categories: `npm run seed:categories`
- [ ] Create admin: `npm run admin:create admin@example.com password123 "Admin Name"`
- [ ] Verify frontend can fetch categories at `/api/colleges/categories/`
- [ ] Test admin login at `/api/admin/login/`
- [ ] Verify student registration form now shows category list

---

## Troubleshooting

### Categories still not showing on frontend:
1. Verify script ran successfully: `npm run seed:categories`
2. Check MongoDB connection: `MONGODB_URI` in `.env`
3. Verify endpoint returns data: `curl http://localhost:8000/api/colleges/categories/`

### Admin login failing:
1. Verify admin was created: Check MongoDB `admin_accounts` collection
2. Check password is correct
3. Verify `is_active: true`
4. Check JWT_SECRET in `.env` is set

### Script permission error:
```bash
chmod +x scripts/createAdmin.js
chmod +x scripts/seedCategories.js
```
