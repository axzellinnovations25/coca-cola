#!/bin/bash

# MotionRep Frontend Deployment Script
echo "🚀 Starting MotionRep Frontend Deployment..."

# Check if we're in the client directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the client directory"
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local not found. Creating one for development..."
    cat > .env.local << EOF
# Development environment variables
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001
EOF
    echo "✅ Created .env.local for development"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🎉 Ready for deployment!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Push your code to Git repository"
    echo "2. Connect your repository to Netlify"
    echo "3. Set environment variables in Netlify:"
    echo "   - NEXT_PUBLIC_BACKEND_URL=http://3.81.158.4:3001"
    echo "   - BACKEND_URL=http://3.81.158.4:3001"
    echo "4. Deploy!"
    echo ""
    echo "📖 See DEPLOYMENT.md for detailed instructions"
else
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi 