# 🔐 AEON Clerk Authentication Setup

## Overview

AEON uses **Clerk** for authentication with **multi-tenant user synchronization** to Supabase. This provides:
- Secure JWT-based authentication
- Automatic user sync to Supabase `users` table
- Tenant isolation and context injection
- Protected routes with middleware

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │         │    Backend   │         │  Supabase   │
│   (Clerk)   │────────▶│ (FastAPI +   │────────▶│  (Users +   │
│             │  JWT    │  Auth Middleware)       │   Data)     │
└─────────────┘         └──────────────┘         └─────────────┘
```

### Flow:
1. User logs in via Clerk on frontend
2. Frontend receives Clerk JWT token
3. Frontend calls `/auth/sync-user` with Clerk user ID
4. Backend creates/updates user in Supabase with `tenant_id`
5. All subsequent requests include JWT in Authorization header
6. Backend validates JWT and injects `tenant_id` context

## Setup Instructions

### 1. Clerk Account Setup

1. Create account at [clerk.com](https://clerk.com)
2. Create new application
3. Get your keys from Dashboard → API Keys:
   - `CLERK_SECRET_KEY` (for backend)
   - `CLERK_PUBLISHABLE_KEY` (for frontend)

### 2. Backend Configuration

Add to `/srv/vulpine-os/backend/.env`:

```bash
# Clerk Authentication
CLERK_SECRET_KEY="sk_test_..."  # Your Clerk secret key
CLERK_PUBLISHABLE_KEY="pk_test_..."  # Your Clerk publishable key
```

**Development Mode:** Leave empty for mock authentication (auto tenant_id = 1)

### 3. Frontend Configuration

Add to `/srv/vulpine-os/frontend/.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

### 4. Database Schema

The `users` table has been updated with:
- `clerk_id` VARCHAR(255) UNIQUE - Maps to Clerk user ID
- `tenant_id` INTEGER - Multi-tenant isolation
- `metadata` JSONB - Additional user data

## API Endpoints

### Public Endpoints (No Auth Required)

```http
POST /auth/sync-user
GET  /auth/health
GET  /
```

### Protected Endpoints (Auth Required)

All other endpoints require valid Clerk JWT in Authorization header:

```http
Authorization: Bearer <clerk_jwt_token>
```

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbG..." \
     http://localhost:8000/jobs/
```

## Development vs Production

### Development Mode (No Clerk Keys)

When `CLERK_SECRET_KEY` is empty:
- Returns mock user (`dev_user_1`, `tenant_id=1`)
- All endpoints accessible without authentication
- Useful for local development and testing

### Production Mode (With Clerk Keys)

When `CLERK_SECRET_KEY` is set:
- Validates Clerk JWT tokens
- Enforces authentication on all protected routes
- Syncs users to Supabase
- Enforces tenant isolation

## Using Authentication in Routes

### Option 1: Get Current User

```python
from fastapi import Depends
from config.auth import get_current_user, ClerkUser

@router.get("/my-endpoint")
async def my_endpoint(user: ClerkUser = Depends(get_current_user)):
    # user.user_id - Clerk user ID
    # user.tenant_id - Tenant for isolation
    # user.email - User email
    pass
```

### Option 2: Require Authentication

```python
from config.auth import require_auth

@router.get("/protected-endpoint")
async def protected_endpoint(user: ClerkUser = Depends(require_auth)):
    # Guaranteed to have authenticated user
    # Returns 401 if not authenticated
    pass
```

### Option 3: Get Tenant ID Only

```python
from config.auth import get_tenant_id

@router.get("/tenant-data")
async def get_tenant_data(tenant_id: int = Depends(get_tenant_id)):
    # Use tenant_id for query filtering
    query = "SELECT * FROM jobs WHERE tenant_id = :tenant_id"
    pass
```

## Tenant Isolation Pattern

All database queries should include tenant filtering:

```python
from config.auth import get_current_user, inject_tenant_context

async def list_jobs(user: ClerkUser = Depends(get_current_user)):
    context = inject_tenant_context(user)
    
    query = """
        SELECT * FROM jobs 
        WHERE tenant_id = :tenant_id 
        AND deleted_at IS NULL
    """
    
    jobs = await fetch_all(query, context)
    return jobs
```

## Frontend Integration (Next.js)

### 1. Install Clerk

```bash
cd /srv/vulpine-os/frontend
npm install @clerk/nextjs
```

### 2. Wrap App with ClerkProvider

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### 3. Protect Routes

```typescript
// app/dashboard/page.tsx
import { auth } from '@clerk/nextjs'

export default function Dashboard() {
  const { userId } = auth()
  
  if (!userId) {
    redirect('/sign-in')
  }
  
  // ... dashboard content
}
```

### 4. Make Authenticated API Calls

```typescript
import { useAuth } from '@clerk/nextjs'

function MyComponent() {
  const { getToken } = useAuth()
  
  async function fetchData() {
    const token = await getToken()
    
    const res = await fetch(`${API_BASE}/jobs/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    return res.json()
  }
}
```

### 5. Sync User on Login

```typescript
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

function App() {
  const { user } = useUser()
  
  useEffect(() => {
    if (user) {
      // Sync user to Supabase
      fetch(`${API_BASE}/auth/sync-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_user_id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          metadata: {}
        })
      })
    }
  }, [user])
}
```

## Testing Authentication

### Test User Sync

```bash
curl -X POST http://localhost:8000/auth/sync-user \
  -H "Content-Type: application/json" \
  -d '{
    "clerk_user_id": "user_2abc123",
    "email": "test@example.com",
    "metadata": {"tenant_id": 1}
  }'
```

**Response:**
```json
{
  "id": 1,
  "tenant_id": 1,
  "email": "test@example.com",
  "clerk_id": "user_2abc123"
}
```

### Test Get Current User

```bash
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer <your_clerk_jwt>"
```

### Test Protected Route (Dev Mode)

```bash
# Works in dev mode without auth
curl http://localhost:8000/jobs/
```

## Troubleshooting

### Error: "Authentication required"

**Cause:** Missing or invalid JWT token in production mode

**Solution:**
- Ensure `Authorization: Bearer <token>` header is included
- Verify Clerk keys are correctly configured
- Check token hasn't expired

### Error: "User not found in database"

**Cause:** User hasn't been synced to Supabase yet

**Solution:**
- Call `/auth/sync-user` after Clerk login
- Implement automatic sync in frontend app initialization

### Dev Mode Not Working

**Cause:** `CLERK_SECRET_KEY` is set but shouldn't be

**Solution:**
- Remove or comment out `CLERK_SECRET_KEY` in `.env`
- Restart backend server

## Security Best Practices

1. **Never commit secrets** - Use `.env` files (already in `.gitignore`)
2. **Use HTTPS in production** - Clerk requires HTTPS for webhooks
3. **Rotate keys regularly** - Update Clerk keys periodically
4. **Validate tenant context** - Always filter by `tenant_id` in queries
5. **Use RLS policies** - Enable Row Level Security in Supabase

## Migration Path

### Current State (MVP)
- ✅ Auth infrastructure ready
- ✅ User sync endpoint
- ✅ Tenant context injection
- ⏳ Development mode active (mock auth)

### Production Ready
- [ ] Set Clerk keys in production `.env`
- [ ] Update frontend with ClerkProvider
- [ ] Implement automatic user sync
- [ ] Add protected route checks
- [ ] Test with real Clerk tokens

---

**Status:** ✅ Auth infrastructure complete, ready for Clerk integration  
**Mode:** Development (mock auth) - Set `CLERK_SECRET_KEY` for production  
**Next Steps:** Frontend Clerk integration + automatic user sync
