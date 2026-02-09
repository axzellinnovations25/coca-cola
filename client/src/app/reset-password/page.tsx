"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { passwordResetAPI } from '@/utils/api';

function ResetPasswordContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawToken = searchParams.get('token');
  const token = rawToken ? decodeURIComponent(rawToken) : null;

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid reset link. Please request a new password reset.');
        setValidating(false);
        return;
      }

      try {
        const data = await passwordResetAPI.validateToken(token);
        
        setTokenValid(true);
        setEmail(data.email);
      } catch (err: any) {
        setError(err.message || 'Invalid or expired reset link. Please request a new password reset.');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, rawToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const data = await passwordResetAPI.resetPassword(token!, password);
      
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f6f3fd] via-[#edeafd] to-[#f7f6fb] p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating your reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row items-center justify-center bg-gradient-to-br from-[#f6f3fd] via-[#edeafd] to-[#f7f6fb] p-4">
      {/* Side Content (hidden on mobile) */}
      <div className="hidden md:flex md:w-[450px] lg:w-[450px] items-center justify-center">
        <div className="w-full bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col justify-between p-8 h-[650px]">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 mb-8" role="img" aria-label="Decorative geometric artwork">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl"></div>
              <div className="absolute top-8 left-8 w-16 h-16 bg-purple-500 rounded-full opacity-90"></div>
              <div className="absolute top-16 right-12 w-12 h-12 bg-blue-400 rounded-lg opacity-80"></div>
              <div className="absolute bottom-20 left-12 w-10 h-10 bg-white rounded-lg shadow-lg"></div>
              <div className="absolute bottom-8 right-8 w-20 h-20 bg-yellow-400 rounded-full opacity-70"></div>
              <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24" viewBox="0 0 100 100" aria-hidden="true">
                <polygon points="20,20 80,30 70,80 30,70" fill="#8b5cf6" opacity="0.6"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Set New Password</h2>
            <p className="text-gray-600 text-center text-base leading-relaxed max-w-xs">Enter your new password below to complete the reset process.</p>
          </div>
          <div className="flex justify-center">
            <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-30" aria-hidden="true"></div>
          </div>
        </div>
      </div>

      {/* Reset Password Form Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-0 md:ml-8">
        <div className="w-full max-w-md md:w-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col justify-between px-6 py-8 md:py-10 md:px-10 h-[650px]">
          <div className="flex-1 flex flex-col">
            <div className="mb-8 flex flex-col items-center">
              <Image src="/MotionRep.png" alt="MotionRep Logo" width={64} height={64} className="rounded-full shadow-lg mb-3 object-contain bg-white" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-1">Reset Password</h1>
              <p className="text-gray-600 text-base md:text-lg text-center">Set your new password</p>
              {email && <p className="text-gray-500 text-sm mt-2">for {email}</p>}
            </div>

            {!tokenValid ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-red-700 text-center bg-red-100 border border-red-200 p-4 rounded-lg mb-6">
                  {error}
                </div>
                <Link href="/forgot-password" className="text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded">
                  Request New Reset Link
                </Link>
              </div>
            ) : (
              <>
                <form className="flex flex-col gap-4" onSubmit={handleSubmit} aria-label="Reset password form">
                  <div className="space-y-1">
                    <label htmlFor="password" className="text-sm font-semibold text-gray-700">New Password</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all pr-12 text-base"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        disabled={loading}
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
                    <p className="text-xs text-gray-500">Password must be at least 8 characters long</p>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">Confirm New Password</label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all pr-12 text-base"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        aria-pressed={showConfirmPassword}
                        disabled={loading}
                      >
                        {showConfirmPassword ? (
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

                  {message && (
                    <div className="text-green-700 text-sm text-center bg-green-100 border border-green-200 p-3 rounded-lg" role="alert" aria-live="polite">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="text-red-700 text-sm text-center bg-red-100 border border-red-200 p-3 rounded-lg" role="alert" aria-live="polite">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold text-lg transition-all duration-200 shadow-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    disabled={loading}
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login" className="text-gray-600 hover:text-purple-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded">
                    ← Back to Login
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col">
            <div className="text-center">
              <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} axzell innovations (Pvt) Ltd. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f6f3fd] via-[#edeafd] to-[#f7f6fb] p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 