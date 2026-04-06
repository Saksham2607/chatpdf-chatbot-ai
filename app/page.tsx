'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err) {
      const authError = err as AuthError;
      switch (authError.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password.');
          break;
        case 'auth/email-already-in-use':
          setError('An account with this email already exists.');
          break;
        case 'auth/weak-password':
          setError('Password must be at least 6 characters.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        default:
          setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#000000', fontFamily: 'var(--font-inter), Inter, sans-serif' }}
    >
      {/* Nav */}
      <nav
        className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-4"
        style={{ backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div
          className="text-lg font-bold tracking-tighter text-white uppercase"
          style={{ fontFamily: 'var(--font-manrope), Manrope, sans-serif', letterSpacing: '0.12em' }}
        >
          ChatPDF
        </div>
      </nav>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-6 pt-24 pb-12">
        <div className="w-full max-w-md space-y-12">
          {/* Hero */}
          <div className="text-center space-y-4">
            <h1
              className="font-extrabold tracking-tighter text-white leading-none"
              style={{
                fontSize: 'clamp(3.5rem, 10vw, 5rem)',
                fontFamily: 'var(--font-manrope), Manrope, sans-serif',
              }}
            >
              ChatPDF
            </h1>
            <p
              className="text-neutral-400 font-light uppercase"
              style={{ fontSize: '10px', letterSpacing: '0.2em' }}
            >
              The Silent Authority in Document Intelligence
            </p>
          </div>

          {/* Card */}
          <div
            className="p-8 md:p-12 rounded-2xl space-y-8"
            style={{
              backgroundColor: '#111111',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
            }}
          >
            <div className="space-y-2">
              <h2
                className="text-xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}
              >
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-neutral-400 text-sm font-light">
                {mode === 'login' ? 'Access your digital vault' : 'Join the future of document AI'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-neutral-400 font-semibold"
                  style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em' }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg px-4 py-3 text-white text-sm transition-all duration-300"
                  style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #2a2a2a',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#ffffff')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="password"
                    className="block text-neutral-400 font-semibold"
                    style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em' }}
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <span
                      className="text-neutral-600 cursor-pointer hover:text-white transition-colors duration-200"
                      style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em' }}
                    >
                      Forgot?
                    </span>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg px-4 py-3 text-white text-sm transition-all duration-300"
                  style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #2a2a2a',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#ffffff')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>

              {/* Confirm Password (signup only) */}
              {mode === 'signup' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-neutral-400 font-semibold"
                    style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.18em' }}
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg px-4 py-3 text-white text-sm transition-all duration-300"
                    style={{
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #2a2a2a',
                      outline: 'none',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#ffffff')}
                    onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div
                  className="text-sm rounded-lg px-4 py-3 animate-fade-in"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-lg font-bold text-sm uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  letterSpacing: '0.1em',
                }}
                onMouseEnter={(e) => {
                  if (!loading) (e.currentTarget.style.backgroundColor = '#e5e5e5');
                }}
                onMouseLeave={(e) => {
                  if (!loading) (e.currentTarget.style.backgroundColor = '#ffffff');
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin-slow w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </span>
                ) : mode === 'login' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Toggle mode */}
            <div className="pt-2 text-center">
              <p className="text-neutral-400 text-xs">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  onClick={toggleMode}
                  className="text-white font-semibold hover:underline ml-1 transition-all"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
