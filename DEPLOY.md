# 🚀 Deploy Guide — Prospector Chevla

This guide explains how to deploy:
- **Frontend** → Any static host (Vercel, Netlify, Hostinger) with a custom subdomain
- **Backend API** → [Railway](https://railway.app)
- **Database** → [Supabase](https://supabase.com) (PostgreSQL)

---

## 1. 📦 Supabase — Database

### Create project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose a name, password, and region (São Paulo if available)
4. Wait for the project to initialize (~2 min)

### Get the connection string
1. Go to **Project Settings → Database → Connection string → URI**
2. Copy the URI (looks like `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`)
3. Replace `[password]` with your actual database password

### Tables are created automatically
The backend creates all tables on first start via `initDatabase()` — no manual SQL needed.

---

## 2. 🚂 Railway — Backend API

### Deploy
1. Sign in to [railway.app](https://railway.app)
2. Click **New Project → Deploy from GitHub repo**
3. Select your repository
4. Set the **Root Directory** to `server`
5. Railway will auto-detect Node.js via `nixpacks`

### Environment Variables
Go to **Variables** tab and add:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
JWT_SECRET=chevla-prospector-secret-2026-ultra-safe
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://YOUR_SUBDOMAIN.com
GOOGLE_MAPS_API_KEY=AIzaSyD77_LqBX-XjlioGC39-SPDZbbf5YWhvkg
ADMIN_USERNAME=AdminChevla
ADMIN_PASSWORD=Chevla@2024!
EMAIL_REJECT_UNAUTHORIZED=false
CHEVLA_EMAIL=contato@chevla.com
CHEVLA_PHONE=(11) 97886-1376
CHEVLA_ADDRESS=Rua Ibitirama, 2060 - São Paulo/SP
```

### Get your Railway URL
After deploy, Railway provides a URL like `https://YOUR-APP.railway.app`
- Note this URL — you'll need it for the frontend

---

## 3. 🌐 Frontend — Static Host with Subdomain

### Build the frontend
```bash
cd client
# Set the production API URL
echo "VITE_API_URL=https://YOUR-APP.railway.app" > .env.production
npm run build
# Output is in client/dist/
```

### Deploy to Vercel (recommended)
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Set **Root Directory** to `client`
4. Add environment variable: `VITE_API_URL=https://YOUR-APP.railway.app`
5. Deploy

### Configure custom subdomain
1. In Vercel: **Domains → Add** your subdomain (e.g. `app.chevla.com`)
2. In your DNS provider: Add a `CNAME` record pointing `app.chevla.com` → `cname.vercel-dns.com`

### Deploy to Netlify (alternative)
```bash
# Site settings → Build command: npm run build
# Publish directory: dist
# Environment variable: VITE_API_URL=https://YOUR-APP.railway.app
```

---

## 4. 🔄 After Deploy — Update Railway CORS

Once you have your subdomain URL, go back to Railway and update:
```
ALLOWED_ORIGINS=https://app.chevla.com,http://localhost:5173
```

The backend reads this on startup to configure CORS.

---

## 5. ✅ Verification Checklist

- [ ] Railway API is running: `https://YOUR-APP.railway.app/health` returns `{"status":"ok"}`
- [ ] Supabase tables created: check Supabase **Table Editor** — you should see `clients`, `contracts`, `users`, etc.
- [ ] Admin user created: first server startup creates the admin account automatically
- [ ] Frontend loads at subdomain and login works
- [ ] CORS is configured: frontend can call the API without errors

---

## 6. 🔑 First Login

Credentials are set by env vars `ADMIN_USERNAME` / `ADMIN_PASSWORD`.  
Default: `AdminChevla` / `Chevla@2024!`  
Change these in Railway Variables after first login!

---

## 7. 📁 Project Structure

```
prospector/
├── client/          # React + Vite frontend
│   ├── .env.production  # VITE_API_URL=https://...railway.app
│   └── dist/        # Built static files (after npm run build)
└── server/          # Node.js + Express backend
    ├── railway.json # Railway deployment config
    ├── .env         # Local dev env (never commit!)
    └── src/
        ├── database.js  # PostgreSQL (pg) connection
        └── routes/      # All API routes (async/await)
```

---

## 8. 🛠 Local Development

```bash
# Terminal 1 — Backend
cd server
cp .env.example .env  # fill in DATABASE_URL from Supabase
npm install
npm run dev  # starts on port 3001

# Terminal 2 — Frontend  
cd client
npm install
npm run dev  # starts on port 5173, proxies /api to localhost:3001
```
