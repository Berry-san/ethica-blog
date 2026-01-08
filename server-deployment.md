# Ethica Blog - VPS Deployment Guide
## For Contabo, DigitalOcean, Linode, Vultr, AWS EC2, etc.

## Table of Contents
- [Overview](#overview)
- [Server Setup](#server-setup)
- [Install Dependencies](#install-dependencies)
- [Database Setup](#database-setup)
- [Deploy Application](#deploy-application)
- [Process Management (PM2)](#process-management-pm2)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [SSL Certificate](#ssl-certificate)
- [Continuous Deployment](#continuous-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## Overview

### Render vs VPS Comparison

| Feature | Render (PaaS) | VPS (Contabo, etc.) |
|---------|---------------|---------------------|
| Setup Complexity | Easy (GUI) | Manual (SSH) |
| Server Management | Automatic | You manage |
| Cost | $7+/month | $4+/month |
| Control | Limited | Full control |
| Scaling | Automatic | Manual |
| SSL | Automatic | Manual setup |

### What You'll Need

- VPS with Ubuntu 22.04 LTS (recommended)
- Domain name (optional but recommended)
- SSH access to your server
- At least 1GB RAM, 1 CPU core, 20GB storage

---

## Server Setup

### Step 1: Connect to Your Server

```bash
# SSH into your server
ssh root@your-server-ip

# Or if you have a username
ssh username@your-server-ip
```

### Step 2: Update System

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential
```

### Step 3: Create Application User (Security Best Practice)

```bash
# Create a non-root user
sudo adduser ethica
sudo usermod -aG sudo ethica

# Switch to new user
su - ethica
```

---

## Install Dependencies

### Install Node.js (v18 LTS)

```bash
# Install Node.js 18 using NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version

# Install Yarn (optional, but your project uses it)
sudo npm install -g yarn
```

### Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify it's running
sudo systemctl status postgresql
```

---

## Database Setup

### Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt:
CREATE DATABASE ethica_blog;
CREATE USER ethica_user WITH ENCRYPTED PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE ethica_blog TO ethica_user;
\q

# For PostgreSQL 15+, also run:
sudo -u postgres psql ethica_blog
GRANT ALL ON SCHEMA public TO ethica_user;
\q
```

### Configure PostgreSQL for Remote Access (if needed)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and change:
listen_addresses = 'localhost'  # Keep as localhost for security

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add this line for local connections:
local   all   ethica_user   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## Deploy Application

### Step 1: Clone Your Repository

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/yourusername/ethica-blog.git
cd ethica-blog

# Or if private repo, use SSH keys or personal access token
git clone https://YOUR_TOKEN@github.com/yourusername/ethica-blog.git
```

### Step 2: Configure Environment Variables

```bash
# Create .env file
nano .env
```

Add your environment variables:

```env
# Database
DATABASE_URL="postgresql://ethica_user:your-strong-password@localhost:5432/ethica_blog?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

### Step 3: Install Dependencies and Build

```bash
# Install dependencies
yarn install

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Build the application
yarn build

# Optional: Seed database
yarn seed
```

### Step 4: Test the Application

```bash
# Test run
yarn start:prod

# In another terminal, test the API
curl http://localhost:3000/health
```

If it works, stop it with `Ctrl+C`.

---

## Process Management (PM2)

PM2 keeps your app running, restarts it on crashes, and manages logs.

### Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2
```

### Create PM2 Ecosystem File

```bash
# Create ecosystem config
nano ecosystem.config.js
```

Add this configuration:

```javascript
module.exports = {
  apps: [{
    name: 'ethica-blog',
    script: 'dist/main.js',
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

### Start Application with PM2

```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Copy and run the command PM2 outputs
# It will look something like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ethica --hp /home/ethica
```

### Useful PM2 Commands

```bash
# View running apps
pm2 list

# View logs
pm2 logs ethica-blog

# View specific app logs
pm2 logs ethica-blog --lines 100

# Restart app
pm2 restart ethica-blog

# Stop app
pm2 stop ethica-blog

# Delete app from PM2
pm2 delete ethica-blog

# Monitor resources
pm2 monit
```

---

## Nginx Reverse Proxy

Nginx acts as a reverse proxy to handle incoming requests and forward them to your Node.js app.

### Install Nginx

```bash
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/ethica-blog
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # Change to your domain or IP

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase client max body size for file uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Optional: Serve static files directly (if you have any)
    # location /static {
    #     alias /home/ethica/ethica-blog/public;
    #     expires 1y;
    #     add_header Cache-Control "public, immutable";
    # }
}
```

### Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ethica-blog /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Or manually:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall (if not already enabled)
sudo ufw enable

# Check status
sudo ufw status
```

---

## SSL Certificate

Use Let's Encrypt for free SSL certificates.

### Install Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
# Get certificate and auto-configure Nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: yes)
```

### Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up auto-renewal via cron/systemd timer
# Verify renewal timer
sudo systemctl status certbot.timer
```

---

## Continuous Deployment

### Option 1: Simple Git Pull Script

```bash
# Create deployment script
nano ~/deploy.sh
```

Add this:

```bash
#!/bin/bash

# Navigate to project
cd ~/ethica-blog

# Pull latest changes
git pull origin main

# Install dependencies
yarn install

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
yarn build

# Restart PM2
pm2 restart ethica-blog

echo "Deployment complete!"
```

Make it executable:

```bash
chmod +x ~/deploy.sh

# Run deployment
~/deploy.sh
```

### Option 2: GitHub Actions + Webhook

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ~/ethica-blog
            git pull origin main
            yarn install
            npx prisma generate
            npx prisma migrate deploy
            yarn build
            pm2 restart ethica-blog
```

Add these secrets to your GitHub repository:
- `SERVER_IP`: Your server IP
- `SERVER_USER`: SSH username
- `SSH_PRIVATE_KEY`: Your SSH private key

---

## Monitoring & Maintenance

### Monitor Application

```bash
# View PM2 status
pm2 list

# Monitor resources in real-time
pm2 monit

# View logs
pm2 logs ethica-blog --lines 100

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Backup

```bash
# Create backup script
nano ~/backup-db.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U ethica_user -h localhost ethica_blog > "$BACKUP_DIR/ethica_blog_$DATE.sql"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "ethica_blog_*.sql" -mtime +7 -delete

echo "Backup completed: ethica_blog_$DATE.sql"
```

Make executable and schedule:

```bash
chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /home/ethica/backup-db.sh
```

### System Updates

```bash
# Regular system updates
sudo apt update && sudo apt upgrade -y

# Update Node.js packages
cd ~/ethica-blog
yarn upgrade

# Update PM2
sudo npm install -g pm2@latest
pm2 update
```

### Monitor Disk Space

```bash
# Check disk usage
df -h

# Check largest directories
du -h --max-depth=1 /home/ethica | sort -hr

# Clean old logs
pm2 flush  # Clear PM2 logs
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs ethica-blog --err

# Check if port 3000 is available
sudo netstat -tlnp | grep 3000

# Test database connection
psql -U ethica_user -h localhost -d ethica_blog
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Database Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Connect to database
psql -U ethica_user -h localhost -d ethica_blog
```

### Out of Memory

```bash
# Check memory usage
free -h

# Increase swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Performance Optimization

### Enable Nginx Caching

```nginx
# Add to Nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

location / {
    proxy_cache my_cache;
    proxy_cache_valid 200 60m;
    # ... rest of proxy settings
}
```

### Enable Gzip Compression

```bash
sudo nano /etc/nginx/nginx.conf

# Find and uncomment/add:
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

### PM2 Cluster Mode

For better CPU utilization:

```javascript
// In ecosystem.config.js
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster'
```

---

## Security Checklist

- [ ] Firewall enabled (ufw)
- [ ] SSH key authentication (disable password auth)
- [ ] Non-root user created
- [ ] Strong database password
- [ ] SSL certificate installed
- [ ] Regular backups configured
- [ ] Fail2ban installed (prevents brute force)
- [ ] Keep system updated
- [ ] Monitor logs regularly

### Install Fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

---

## Quick Reference Commands

```bash
# Application Management
pm2 restart ethica-blog
pm2 logs ethica-blog
pm2 monit

# Nginx
sudo systemctl reload nginx
sudo nginx -t

# Database
sudo systemctl restart postgresql
psql -U ethica_user -d ethica_blog

# Deployment
cd ~/ethica-blog && git pull && yarn install && yarn build && pm2 restart ethica-blog

# System
df -h  # Disk space
free -h  # Memory usage
htop  # System monitor
```

---

## Cost Comparison

**Contabo VPS 1** (~$5/month):
- 4 vCPU Cores
- 6 GB RAM
- 100 GB SSD
- Unlimited traffic

**vs Render** ($7-25/month):
- Managed platform
- Auto-scaling
- Easier deployment

**VPS is cheaper but requires more technical knowledge.**

---

## Support Resources

- **Contabo Support**: https://contabo.com/en/support/
- **NestJS Docs**: https://docs.nestjs.com
- **PM2 Docs**: https://pm2.keymetrics.io
- **Nginx Docs**: https://nginx.org/en/docs/