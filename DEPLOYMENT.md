# AEON Deployment Guide

## 🚀 Overview

AEON uses a modern CI/CD pipeline with GitHub Actions for automated testing, building, and deployment.

## 📋 Prerequisites

- GitHub repository with Actions enabled
- Container registry (Docker Hub, GitHub Container Registry, AWS ECR, etc.)
- Production infrastructure (Kubernetes, AWS ECS, Docker Swarm, etc.)
- PostgreSQL database
- Domain with SSL certificates

## 🔧 Setup

### 1. Configure GitHub Secrets

Go to `Settings > Secrets and variables > Actions` and add:

#### Container Registry
- `CONTAINER_REGISTRY` - Registry URL (e.g., ghcr.io/your-org)
- `REGISTRY_USERNAME` - Registry username
- `REGISTRY_PASSWORD` - Registry password/token

#### Database
- `PRODUCTION_DB_URL` - Production database connection string
- `PREVIEW_DB_URL` - Preview environment database (template)

#### API & Security
- `API_TOKEN` - API authentication token
- `SECRET_KEY` - Application secret key
- `JWT_SECRET` - JWT signing secret

#### Integrations
- `STRIPE_API_KEY` - Stripe API key
- `TWILIO_ACCOUNT_SID` - Twilio SID
- `TWILIO_AUTH_TOKEN` - Twilio token
- `SENDGRID_API_KEY` - SendGrid API key
- `OPENAI_API_KEY` - OpenAI API key

#### Infrastructure
- `KUBECONFIG` - Kubernetes config (if using K8s)
- `AWS_ACCESS_KEY_ID` - AWS access key (if using AWS)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in production values:

```bash
cp .env.example .env
# Edit .env with your production values
```

### 3. Build Docker Images Locally (Optional)

```bash
# Build backend
docker build -t aeon-backend:local ./backend

# Build frontend
docker build -t aeon-frontend:local \
  --build-arg NEXT_PUBLIC_API_BASE=http://localhost:8000 \
  ./frontend
```

### 4. Test with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Run migrations
docker-compose exec backend python scripts/migrate.py

# Stop services
docker-compose down
```

## 🔄 CI/CD Workflows

### Continuous Integration (`ci.yml`)

**Triggers:** Pull requests and pushes to `main` or `develop`

**Steps:**
1. Backend tests (Python syntax, linting, type checking)
2. Frontend tests (TypeScript compilation, linting, build)
3. Security scan (Trivy vulnerability scanner)
4. AEON audit script

**Result:** Green checkmark if all tests pass

### Preview Deployment (`preview-deploy.yml`)

**Triggers:** Pull requests to `main`

**Steps:**
1. Build and push Docker images with PR tag
2. Deploy to isolated preview environment
3. Run database migrations
4. Run smoke tests
5. Comment on PR with preview URLs

**Preview URL:** `https://aeon-pr-{number}.preview.example.com`

**Cleanup:** Preview environments are automatically deleted when PR is closed

### Production Deployment (`production-deploy.yml`)

**Triggers:** Pushes to `main` branch or manual dispatch

**Steps:**
1. Build and push production Docker images
2. Create database backup
3. Run database migrations
4. Deploy to production (blue-green)
5. Run health checks
6. Run smoke tests
7. Refresh materialized views
8. Clear caches
9. Create deployment tag

**Rollback:** Automatically rolls back on failure

## 📦 Deployment Strategies

### Blue-Green Deployment (Recommended)

1. Deploy new version to "green" environment
2. Run health checks on green
3. Switch traffic from blue to green
4. Monitor for issues
5. Keep blue as rollback option

### Rolling Update

1. Update pods/containers one at a time
2. Wait for health checks
3. Continue to next pod
4. Zero downtime

### Canary Deployment

1. Deploy new version to small percentage of traffic
2. Monitor metrics
3. Gradually increase traffic
4. Rollback if issues detected

## 🗄️ Database Migrations

### Run Migrations Manually

```bash
# Check migration status
python backend/scripts/migrate.py status

# Run pending migrations
python backend/scripts/migrate.py migrate

# Rollback a migration
python backend/scripts/migrate.py rollback 001_initial_schema
```

### Automated Migrations

Migrations run automatically during deployment:
- Preview: Runs on preview database
- Production: Runs with backup + rollback capability

## 🔍 Health Checks

### Endpoints

- `GET /health` - General health check
- `GET /orchestrator/heartbeat` - Orchestrator health
- `GET /performance/health` - Performance system health
- `GET /security/health` - Security system health

### Monitoring

```bash
# Check backend health
curl https://api.aeon.example.com/health

# Check frontend
curl https://aeon.example.com/

# Check all systems
curl https://api.aeon.example.com/orchestrator/health
```

## 🚨 Rollback Procedures

### Automatic Rollback

Deployment automatically rolls back if:
- Health checks fail
- Smoke tests fail
- Deployment process errors

### Manual Rollback

#### Using Kubernetes
```bash
# Rollback to previous version
kubectl rollout undo deployment/aeon-backend -n production
kubectl rollout undo deployment/aeon-frontend -n production

# Rollback to specific version
kubectl rollout undo deployment/aeon-backend --to-revision=2
```

#### Using Docker
```bash
# Redeploy previous image
docker pull aeon-backend:v123
docker service update --image aeon-backend:v123 aeon-backend
```

#### Database Rollback
```bash
# Restore from backup
pg_restore -d aeon_production backup_20251130.sql
```

## 📊 Post-Deployment Tasks

After successful deployment:

1. **Refresh Materialized Views**
   ```bash
   curl -X POST https://api.aeon.example.com/performance/materialized-views/refresh
   ```

2. **Clear Caches**
   ```bash
   curl -X POST https://api.aeon.example.com/performance/cache/clear
   ```

3. **Run Security Audit**
   ```bash
   python backend/scripts/security_audit.py
   ```

4. **Check Metrics**
   - Visit `/performance/dashboard`
   - Check slow queries
   - Verify cache hit rates

## 🔧 Troubleshooting

### Deployment Fails

1. Check GitHub Actions logs
2. Verify secrets are configured
3. Check database connectivity
4. Verify container registry access

### Health Checks Fail

1. Check application logs
2. Verify database connection
3. Check network connectivity
4. Verify environment variables

### Database Migration Fails

1. Check migration logs
2. Restore from backup
3. Run migrations manually
4. Verify database schema

### Performance Issues

1. Check `/performance/metrics`
2. Review slow queries
3. Check cache hit rates
4. Monitor system resources

## 📝 Best Practices

1. **Always test in preview first**
2. **Run migrations during low-traffic periods**
3. **Keep backups for at least 30 days**
4. **Monitor deployments for 30 minutes**
5. **Tag releases with version numbers**
6. **Document all manual interventions**
7. **Test rollback procedures regularly**

## 🔐 Security Considerations

1. **Never commit secrets to repository**
2. **Use GitHub Secrets for sensitive data**
3. **Rotate secrets regularly**
4. **Enable 2FA on all accounts**
5. **Use least-privilege access**
6. **Scan images for vulnerabilities**
7. **Keep dependencies updated**

## 📞 Support

For deployment issues:
1. Check GitHub Actions logs
2. Review deployment documentation
3. Check system health endpoints
4. Contact DevOps team

## 🎯 Deployment Checklist

- [ ] All tests passing in CI
- [ ] Preview deployment successful
- [ ] Database backup created
- [ ] Secrets configured
- [ ] SSL certificates valid
- [ ] Monitoring enabled
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Post-deployment checks completed
