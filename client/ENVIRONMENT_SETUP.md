# Environment Variables Setup

## Overview
MotionRep uses environment variables to configure backend URLs for different environments. This allows the same codebase to work across development, staging, and production environments.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | Public backend URL (accessible from browser) | `http://localhost:3001` |
| `BACKEND_URL` | Backend URL for server-side operations | `http://localhost:3001` |

## Environment Configurations

### Development (Local)
Create a `.env.local` file in the `client` directory:
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001
```

### Production (Netlify)
Set these environment variables in your Netlify dashboard:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Add the following variables:

```bash
NEXT_PUBLIC_BACKEND_URL=http://3.81.158.4:3001
BACKEND_URL=http://3.81.158.4:3001
```

### Staging (if needed)
```bash
NEXT_PUBLIC_BACKEND_URL=http://your-staging-backend.com
BACKEND_URL=http://your-staging-backend.com
```

## Why Environment Variables?

1. **Flexibility**: Same code works across different environments
2. **Security**: Sensitive URLs not hardcoded in source code
3. **Maintainability**: Easy to change backend URLs without code changes
4. **Best Practice**: Industry standard for configuration management

## Current Setup

- **Development**: Uses `localhost:3001` (local backend)
- **Production**: Uses `3.81.158.4:3001` (hosted backend)
- **Fallback**: If no environment variable is set, defaults to `localhost:3001`

## Troubleshooting

### Frontend can't connect to backend
1. Check environment variables are set correctly
2. Verify backend is running and accessible
3. Check CORS configuration on backend
4. Ensure URLs are correct (no typos)

### Environment variables not working
1. Restart development server after changing `.env.local`
2. Check variable names are correct (case-sensitive)
3. Ensure `.env.local` is in the `client` directory
4. For Netlify, redeploy after setting environment variables 