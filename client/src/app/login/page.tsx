"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f6f3fd] via-[#edeafd] to-[#f7f6fb]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row items-center justify-center bg-gradient-to-br from-[#f6f3fd] via-[#edeafd] to-[#f7f6fb] p-4">
      {/* Side Content (hidden on mobile) */}
      <div className="hidden md:flex md:w-[450px] lg:w-[450px] items-center justify-center">
        <div className="w-full bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col justify-between p-8 h-[650px]">
          {/* Top section with artwork */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 mb-8" role="img" aria-label="Decorative geometric artwork">
              {/* Background shapes */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl"></div>
              
              {/* Geometric elements */}
              <div className="absolute top-8 left-8 w-16 h-16 bg-purple-500 rounded-full opacity-90"></div>
              <div className="absolute top-16 right-12 w-12 h-12 bg-blue-400 rounded-lg opacity-80"></div>
              <div className="absolute bottom-20 left-12 w-10 h-10 bg-white rounded-lg shadow-lg"></div>
              <div className="absolute bottom-8 right-8 w-20 h-20 bg-yellow-400 rounded-full opacity-70"></div>
              
              {/* Abstract shape */}
              <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24" viewBox="0 0 100 100" aria-hidden="true">
                <polygon points="20,20 80,30 70,80 30,70" fill="#8b5cf6" opacity="0.6"/>
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Empower your business</h2>
            <p className="text-gray-600 text-center text-base leading-relaxed max-w-xs">Customize as you like. Empower your bussiness journey with MotionRep.</p>
          </div>
          
          {/* Bottom section for balance */}
          <div className="flex justify-center">
            <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-30" aria-hidden="true"></div>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-0 md:ml-8">
        {/* Top navigation for mobile */}
        <div className="w-full max-w-md mx-auto flex justify-between items-center pt-4 pb-4 md:hidden">
          <div />
          <div />
        </div>
        
        {/* Card */}
        <div className="w-full max-w-md md:w-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col justify-between px-6 py-8 md:py-10 md:px-10 h-[650px]">
          {/* Top section */}
          <div className="flex-1 flex flex-col">
            {/* Logo/Header */}
            <div className="mb-8 flex flex-col items-center">
              <Image src="/MotionRep.png" alt="MotionRep Logo" width={64} height={64} className="rounded-full shadow-lg mb-3 object-contain bg-white" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-1">Welcome Back</h1>
              <p className="text-gray-600 text-base md:text-lg text-center">Sign in to your account</p>
            </div>

            {/* Form */}
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} aria-label="Login form">
              {/* Email Field */}
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="nicholas@ergemla.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all text-base"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  aria-describedby="email-error"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all pr-12 text-base"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    aria-describedby="password-error"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div 
                  id="login-error"
                  className="text-red-700 text-sm text-center bg-red-100 border border-red-200 p-3 rounded-lg"
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </div>
              )}

              {/* Sign In Button */}
              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold text-lg transition-all duration-200 shadow-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                disabled={loading}
                aria-describedby={error ? "login-error" : undefined}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* Forgot Password */}
            <div className="mt-4 text-center">
              <a 
                href="/forgot-password" 
                className="text-gray-600 hover:text-purple-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
              >
                Forgot your password?
              </a>
            </div>
          </div>

          {/* Bottom section */}
          <div className="flex flex-col">
            

            {/* Footer */}
            <div className="text-center">
              <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} axzell innovations (Pvt) Ltd. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 