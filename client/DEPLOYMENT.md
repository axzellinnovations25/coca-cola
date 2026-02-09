# MotionRep Frontend Deployment Guide

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Netlify account
- Git repository connected to Netlify

## Environment Variables Setup

### For Development
Create a `.env.local` file in the client directory:
```bash
# Development environment variables
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001
```

### For Production (Netlify)
Set these environment variables in your Netlify dashboard:

1. Go to your Netlify site dashboard
2. Navigate to Site settings > Environment variables
3. Add the following variables:

```
NEXT_PUBLIC_BACKEND_URL=http://3.81.158.4:3001
BACKEND_URL=http://3.81.158.4:3001
```

## Deployment Steps

### 1. Build Locally (Optional - for testing)
```bash
cd client
npm install
npm run build
```

### 2. Deploy to Netlify

#### Option A: Deploy via Git (Recommended)
1. Push your code to your Git repository
2. Connect your repository to Netlify
3. Set build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Node version: 18

#### Option B: Deploy via Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
cd client
netlify deploy --prod
```

### 3. Configure Domain (Optional)
- Go to your Netlify site dashboard
- Navigate to Domain settings
- Add your custom domain

## Post-Deployment Verification

1. **Check API Connectivity**: Visit your deployed site and try to log in
2. **Verify Environment Variables**: Check that the site is connecting to the hosted backend
3. **Test All Features**: Ensure all functionality works as expected

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (should be 18+)
   - Ensure all dependencies are installed
   - Check for TypeScript errors

2. **API Connection Issues**
   - Verify environment variables are set correctly
   - Check that the backend URL is accessible
   - Ensure CORS is properly configured on the backend

3. **Routing Issues**
   - Check that the `netlify.toml` file is in the client directory
   - Verify redirect rules are working

### Environment Variable Debugging
Add this to your component temporarily to debug:
```javascript
console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
```

## Security Considerations

1. **Environment Variables**: Never commit sensitive environment variables to Git
2. **CORS**: Ensure your backend allows requests from your Netlify domain
3. **HTTPS**: Netlify provides HTTPS by default - ensure your backend supports HTTPS

## Performance Optimization

1. **Caching**: Static assets are automatically cached by Netlify
2. **CDN**: Netlify provides global CDN for better performance
3. **Compression**: Assets are automatically compressed

## Monitoring

1. **Netlify Analytics**: Enable in your site dashboard
2. **Error Tracking**: Monitor for build and runtime errors
3. **Performance**: Use Netlify's built-in performance monitoring 