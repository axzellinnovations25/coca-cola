"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { passwordResetAPI } from '@/utils/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      console.log('🔧 Submitting forgot password request for:', email);
      
      const data = await passwordResetAPI.forgotPassword(email);
      
      console.log('✅ Forgot password response:', data);
      
      if (data.success) {
        setMessage(data.message || 'Password reset link sent to your email!');
      } else {
        setError(data.error || 'An error occurred. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Forgot password error:', err);
      
      // Handle specific error cases
      if (err.message && err.message.includes('No account found')) {
        setError('No account found with this email address. Please check your email or contact support.');
      } else if (err.message && err.message.includes('Failed to send')) {
        setError('Failed to send password reset email. Please try again later.');
      } else {
        setError(err.message || 'Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
            
            <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Reset Your Password</h2>
            <p className="text-gray-600 text-center text-base leading-relaxed max-w-xs">Enter your email address and we'll send you a link to reset your password.</p>
          </div>
          
          {/* Bottom section for balance */}
          <div className="flex justify-center">
            <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-30" aria-hidden="true"></div>
          </div>
        </div>
      </div>

      {/* Forgot Password Form Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-0 md:ml-8">
        {/* Card */}
        <div className="w-full max-w-md md:w-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col justify-between px-6 py-8 md:py-10 md:px-10 h-[650px]">
          {/* Top section */}
          <div className="flex-1 flex flex-col">
            {/* Logo/Header */}
            <div className="mb-8 flex flex-col items-center">
              <Image src="/MotionRep.png" alt="MotionRep Logo" width={64} height={64} className="rounded-full shadow-lg mb-3 object-contain bg-white" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-1">Forgot Password</h1>
              <p className="text-gray-600 text-base md:text-lg text-center">Enter your email to reset your password</p>
            </div>

            {/* Form */}
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} aria-label="Forgot password form">
              {/* Email Field */}
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all text-base"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>

              {/* Success Message */}
              {message && (
                <div 
                  className="text-green-700 text-sm text-center bg-green-100 border border-green-200 p-3 rounded-lg"
                  role="alert"
                  aria-live="polite"
                >
                  {message}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div 
                  className="text-red-700 text-sm text-center bg-red-100 border border-red-200 p-3 rounded-lg"
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold text-lg transition-all duration-200 shadow-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link 
                href="/login" 
                className="text-gray-600 hover:text-purple-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
              >
                ← Back to Login
              </Link>
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