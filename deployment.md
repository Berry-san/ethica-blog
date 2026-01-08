# Ethica Blog - Production Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Deploying to Render](#deploying-to-render)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)
- [Local Development](#local-development)

---

## Prerequisites

Before deploying, ensure you have:

1. **A PostgreSQL Database** (Render provides free PostgreSQL databases)
2. **Cloudinary Account** (for image uploads)
3. **Git Repository** connected to Render
4. **Node.js 18+** installed locally for testing

---

## Environment Variables

Create a `.env` file for local development and configure these variables in Render:

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS (Optional - adjust based on your frontend URL)
CORS_ORIGIN=https://your-frontend-domain.com

# Rate Limiting (Optional)
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

### How to Generate JWT_SECRET

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

---

## Deploying to Render

### Step 1: Create a PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `ethica-blog-db`
   - **Database**: `ethica_blog`
   - **User**: (auto-generated)
   - **Region**: Choose closest to your users
   - **Plan**: Free or paid based on needs
4. Click **Create Database**
5. Copy the **Internal Database URL** (starts with `postgresql://`)

### Step 2: Create Web Service

1. Click **New +** → **Web Service**
2. Connect your Git repository
3. Configure the service:

#### Basic Settings
- **Name**: `ethica-blog-api`
- **Region**: Same as your database
- **Branch**: `main` (or your production branch)
- **Root Directory**: Leave blank (unless your code is in a subdirectory)
- **Environment**: `Node`
- **Build Command**: 
  ```bash
  yarn install && npx prisma generate && yarn build
  ```
- **Start Command**: 
  ```bash
  npx prisma migrate deploy && yarn start:prod
  ```

#### Advanced Settings
- **Plan**: Free or paid based on needs
- **Auto-Deploy**: Yes (recommended)

### Step 3: Add Environment Variables

In your Render web service dashboard:

1. Go to **Environment** tab
2. Add each environment variable from the list above
3. For `DATABASE_URL`, use the **Internal Database URL** from your PostgreSQL database

**Important Variables:**
```
DATABASE_URL=<your-postgres-internal-url>
JWT_SECRET=<your-generated-secret>
JWT_EXPIRES_IN=7d
NODE_ENV=production
CLOUDINARY_CLOUD_NAME=<your-cloudinary-name>
CLOUDINARY_API_KEY=<your-cloudinary-key>
CLOUDINARY_API_SECRET=<your-cloudinary-secret>
```

### Step 4: Deploy

1. Click **Create Web Service**
2. Render will automatically start building and deploying
3. Monitor the logs for any errors
4. Once deployed, you'll get a URL like: `https://ethica-blog-api.onrender.com`

---

## Post-Deployment

### Verify Deployment

Test your API endpoints:

```bash
# Health check
curl https://your-app.onrender.com/health

# Or open in browser
https://your-app.onrender.com/api
```

### Run Database Migrations

Migrations run automatically during deployment via the start command, but if you need to run them manually:

1. Go to **Shell** tab in Render dashboard
2. Run:
   ```bash
   npx prisma migrate deploy
   ```

### Seed Database (Optional)

If you need to populate initial data:

1. Go to **Shell** tab
2. Run:
   ```bash
   npm run seed
   ```

### View API Documentation

If Swagger is configured, visit:
```
https://your-app.onrender.com/api
```

---

## Troubleshooting

### Build Fails with "nest: not found"

**Solution**: Ensure `@nestjs/cli` is in `dependencies`, not `devDependencies`.

### Database Connection Errors

**Symptoms**: 
```
Error: P1001: Can't reach database server
```

**Solutions**:
1. Verify `DATABASE_URL` is set correctly
2. Use the **Internal Database URL** (not External)
3. Ensure database and web service are in the same region
4. Check database is running in Render dashboard

### Prisma Client Not Generated

**Symptoms**:
```
Error: Cannot find module '@prisma/client'
```

**Solution**: 
- Ensure build command includes `npx prisma generate`
- Add `postinstall` script in package.json:
  ```json
  "postinstall": "prisma generate"
  ```

### Port Already in Use

**Solution**: Render automatically assigns the `PORT` variable. Ensure your app uses:
```typescript
const port = process.env.PORT || 3000;
await app.listen(port);
```

### CORS Issues

**Symptoms**: Frontend can't connect to API

**Solution**: Configure CORS in your main.ts:
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});
```

### Memory Issues / Crashes

**Solutions**:
1. Upgrade to a paid plan with more memory
2. Optimize your code and database queries
3. Add proper error handling and logging

### Logs Not Showing

View logs in Render:
1. Go to your service dashboard
2. Click **Logs** tab
3. Use filters to find specific errors

---

## Local Development

### Initial Setup

```bash
# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env

# Edit .env with your local settings
nano .env

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
yarn seed
```

### Development Server

```bash
# Start development server with hot reload
yarn start:dev

# The server will run on http://localhost:3000
```

### Testing

```bash
# Run unit tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run e2e tests
yarn test:e2e

# Generate coverage report
yarn test:cov
```

### Database Management

```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# Open Prisma Studio (Database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

---

## Continuous Deployment

### Automatic Deployments

Render automatically deploys when you push to your connected branch:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Manual Deploy

In Render dashboard:
1. Go to your service
2. Click **Manual Deploy** → **Deploy latest commit**

### Rollback

If a deployment fails:
1. Go to **Events** tab
2. Find a previous successful deployment
3. Click **Rollback to this version**

---

## Performance Tips

1. **Use Connection Pooling**: Prisma handles this automatically
2. **Enable Compression**: Add compression middleware
3. **Implement Caching**: Use Redis for frequently accessed data
4. **Monitor Performance**: Use Render metrics or external tools like New Relic
5. **Optimize Database Queries**: Use Prisma query optimization
6. **Enable Logging**: Monitor application logs for errors

---

## Security Checklist

- [ ] Strong JWT_SECRET (64+ characters)
- [ ] Environment variables properly set
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (`@nestjs/throttler`)
- [ ] Helmet.js configured for security headers
- [ ] Database credentials not exposed
- [ ] API endpoints properly validated
- [ ] Authentication on protected routes

---

## Scaling

When your app grows:

1. **Upgrade Render Plan**: More CPU/Memory
2. **Add Redis**: For caching and sessions
3. **Use CDN**: For static assets (Cloudinary handles this)
4. **Database Optimization**: Add indexes, optimize queries
5. **Load Balancing**: Render handles this on paid plans
6. **Monitoring**: Set up application monitoring

---

## Useful Commands

```bash
# View Render logs in real-time
# (Use Render dashboard or CLI)

# Connect to Render shell
# (Use Shell tab in Render dashboard)

# Check service status
# (Use Render dashboard)

# View environment variables
# (Use Environment tab in Render dashboard)
```

---

## Support

- **Render Docs**: https://render.com/docs
- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Docs**: https://www.prisma.io/docs

---

## License

UNLICENSED - Private Project