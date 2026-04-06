'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type UploadState = 'idle' | 'uploading' | 'done' | 'error';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function getInitial(email: string | null | undefined) {
  if (!email) return 'U';
  return email[0].toUpperCase();
}

// ------------------------------------------------------------------
// Dashboard page
// ------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [chunkCount, setChunkCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');

  // ------------------------------------------------------------------
  // Auth guard
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // ------------------------------------------------------------------
  // Chat  — using AI SDK useChat with custom transport
  // ------------------------------------------------------------------
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        userId: user?.uid ?? '',
      }),
    }),
  });

  // Scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // ------------------------------------------------------------------
  // Upload handler
  // ------------------------------------------------------------------
  const handleFile = useCallback(
    async (file: File) => {
      if (!file || !user) return;
      if (file.type !== 'application/pdf') {
        setUploadError('Only PDF files are supported.');
        setUploadState('error');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setUploadError('File exceeds the 50 MB limit.');
        setUploadState('error');
        return;
      }

      setUploadState('uploading');
      setUploadError('');
      setUploadedFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.uid);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        setChunkCount(data.chunkCount);
        setUploadState('done');
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
        setUploadState('error');
      }
    },
    [user],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ------------------------------------------------------------------
  // Send message
  // ------------------------------------------------------------------
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || status !== 'ready') return;
    sendMessage({ text });
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  // ------------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------------
  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  // ------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#000000' }}
      >
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin-slow w-8 h-8 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-neutral-600 text-xs uppercase tracking-widest">Loading</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        fontFamily: 'var(--font-inter), Inter, sans-serif',
        height: '100vh',
      }}
    >
      {/* ── Top Nav ── */}
      <nav
        className="fixed top-0 w-full z-50 flex justify-between items-center px-8"
        style={{
          height: '80px',
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div
          className="font-black tracking-tighter text-white"
          style={{ fontSize: '1.5rem', fontFamily: 'var(--font-manrope), Manrope, sans-serif' }}
        >
          ChatPDF
        </div>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined cursor-pointer transition-colors duration-200 text-neutral-500 hover:text-white">
            notifications
          </span>
          <span className="material-symbols-outlined cursor-pointer transition-colors duration-200 text-neutral-500 hover:text-white">
            settings
          </span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            title={user.email ?? 'User'}
          >
            {getInitial(user.email)}
          </div>
        </div>
      </nav>

      {/* ── Layout ── */}
      <div className="flex" style={{ height: '100vh', paddingTop: '80px' }}>
        {/* ── Sidebar ── */}
        <aside
          className="fixed left-0 flex flex-col py-12 px-4 z-40"
          style={{
            top: '80px',
            width: '256px',
            height: 'calc(100vh - 80px)',
            backgroundColor: '#0a0a0a',
            borderRight: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="mb-10 px-4">
            <h2
              className="text-white font-bold text-sm uppercase"
              style={{ letterSpacing: '0.15em' }}
            >
              Library
            </h2>
            <p className="text-neutral-500 text-xs mt-1">Your Documents</p>
          </div>

          <nav className="flex-1 flex flex-col gap-1">
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <span className="material-symbols-outlined text-white">folder_open</span>
              <span className="text-sm font-medium text-white">My PDFs</span>
            </div>
          </nav>

          <div className="mt-auto px-4 pb-6">
            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors duration-200"
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e5e5e5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              Upload PDF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />

            <div className="mt-8 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-neutral-500 hover:text-white cursor-pointer transition-colors duration-200">
                <span className="material-symbols-outlined">account_circle</span>
                <span className="text-sm truncate max-w-[140px]">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 text-neutral-500 hover:text-white cursor-pointer transition-colors duration-200 w-full text-left bg-transparent border-0 p-0"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="text-sm">Log Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Area ── */}
        <main
          className="flex"
          style={{ marginLeft: '256px', flex: 1, height: 'calc(100vh - 80px)' }}
        >
          {/* ── PDF Drop Zone panel ── */}
          <section
            className="flex flex-col gap-8 overflow-y-auto custom-scrollbar"
            style={{
              flex: 1.2,
              backgroundColor: '#000000',
              padding: '40px',
            }}
          >
            <header className="flex flex-col gap-2">
              <h1
                className="font-extrabold tracking-tighter text-white"
                style={{
                  fontSize: '3rem',
                  fontFamily: 'var(--font-manrope), Manrope, sans-serif',
                  lineHeight: 1,
                }}
              >
                Active Analysis
              </h1>
              <p className="text-neutral-500 text-sm max-w-md">
                Drop your PDF here to begin. Ask anything about it on the right.
              </p>
            </header>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => uploadState === 'idle' || uploadState === 'error' ? fileInputRef.current?.click() : undefined}
              className="flex-1 rounded-xl flex flex-col items-center justify-center p-12 transition-all duration-300 cursor-pointer"
              style={{
                minHeight: '400px',
                border: `1px dashed ${isDragging ? '#ffffff' : uploadState === 'done' ? '#16a34a' : uploadState === 'error' ? '#dc2626' : '#2a2a2a'}`,
                backgroundColor: isDragging ? 'rgba(255,255,255,0.02)' : 'rgba(10,10,10,0.4)',
              }}
            >
              {uploadState === 'idle' && (
                <>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{ backgroundColor: '#1a1a1a' }}
                  >
                    <span
                      className="material-symbols-outlined text-white"
                      style={{ fontSize: '28px' }}
                    >
                      picture_as_pdf
                    </span>
                  </div>
                  <h3 className="text-white font-medium text-lg">Drag and drop document</h3>
                  <p className="text-neutral-500 text-sm mt-2">Maximum file size 50 MB</p>
                  <div className="mt-8">
                    <span
                      className="px-6 py-2 rounded-full text-xs font-bold transition-colors duration-200"
                      style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    >
                      Browse Files
                    </span>
                  </div>
                </>
              )}

              {uploadState === 'uploading' && (
                <>
                  <svg
                    className="animate-spin-slow w-12 h-12 mb-6"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-20"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="white"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-80"
                      fill="white"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <p className="text-white font-medium text-lg">Processing PDF…</p>
                  <p className="text-neutral-500 text-sm mt-2 truncate max-w-xs">
                    {uploadedFileName}
                  </p>
                  <p className="text-neutral-600 text-xs mt-1">
                    Extracting text and generating embeddings
                  </p>
                </>
              )}

              {uploadState === 'done' && (
                <>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{ backgroundColor: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)' }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: '#4ade80', fontSize: '28px' }}
                    >
                      check_circle
                    </span>
                  </div>
                  <h3 className="font-medium text-lg" style={{ color: '#4ade80' }}>
                    Document Ready
                  </h3>
                  <p className="text-neutral-400 text-sm mt-2 truncate max-w-xs">
                    {uploadedFileName}
                  </p>
                  <p className="text-neutral-600 text-xs mt-1">{chunkCount} chunks indexed</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadState('idle');
                      setUploadedFileName(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="mt-6 px-4 py-2 rounded-full text-xs font-bold transition-colors duration-200"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #2a2a2a',
                      color: '#a3a3a3',
                    }}
                  >
                    Upload Another
                  </button>
                </>
              )}

              {uploadState === 'error' && (
                <>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{
                      backgroundColor: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.3)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: '#f87171', fontSize: '28px' }}
                    >
                      error
                    </span>
                  </div>
                  <h3 className="font-medium text-lg" style={{ color: '#f87171' }}>
                    Upload Failed
                  </h3>
                  <p className="text-neutral-500 text-sm mt-2 text-center max-w-xs">
                    {uploadError}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadState('idle'); setUploadError(''); }}
                    className="mt-6 px-6 py-2 rounded-full text-xs font-bold"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          </section>

          {/* ── Chat panel ── */}
          <section
            className="flex flex-col relative"
            style={{
              flex: 1,
              backgroundColor: '#0a0a0a',
              borderLeft: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {/* Chat header */}
            <div
              className="flex items-center gap-3 p-6"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: '#ffffff',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                }}
              />
              <h2
                className="text-sm font-bold uppercase text-white"
                style={{ letterSpacing: '0.15em' }}
              >
                ChatPDF AI
              </h2>
              {(status === 'streaming' || status === 'submitted') && (
                <div
                  className="ml-auto text-xs px-2 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#a3a3a3' }}
                >
                  Thinking
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              {/* Welcome message */}
              <div className="flex gap-4 animate-fade-in">
                <div
                  className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: '#000000', fontSize: '16px' }}
                  >
                    auto_awesome
                  </span>
                </div>
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div
                    className="text-xs font-medium text-neutral-500"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    CHATPDF AI
                  </div>
                  <div
                    className="p-4 text-neutral-200 text-sm leading-relaxed"
                    style={{
                      backgroundColor: '#161616',
                      borderRadius: '0 12px 12px 12px',
                    }}
                  >
                    Upload a PDF to get started. I&apos;ll answer any questions you have about it.
                  </div>
                </div>
              </div>

              {/* Conversation messages */}
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const textContent = message.parts
                  .filter((p) => p.type === 'text')
                  .map((p) => (p as { type: 'text'; text: string }).text)
                  .join('');

                return (
                  <div
                    key={message.id}
                    className={`flex gap-4 animate-fade-in ${isUser ? 'justify-end' : ''}`}
                  >
                    {!isUser && (
                      <div
                        className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ color: '#000000', fontSize: '16px' }}
                        >
                          auto_awesome
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : ''}`}
                    >
                      <div
                        className="text-xs font-medium text-neutral-500"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        {isUser ? 'YOU' : 'CHATPDF AI'}
                      </div>
                      <div
                        className="p-4 text-sm leading-relaxed whitespace-pre-wrap"
                        style={
                          isUser
                            ? {
                                backgroundColor: '#1a1a1a',
                                color: '#ffffff',
                                border: '1px solid #2a2a2a',
                                borderRadius: '12px 0 12px 12px',
                              }
                            : {
                                backgroundColor: '#161616',
                                color: '#e5e5e5',
                                borderRadius: '0 12px 12px 12px',
                              }
                        }
                      >
                        {textContent}
                      </div>
                    </div>
                    {isUser && (
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
                      >
                        {getInitial(user.email)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {(status === 'submitted' || status === 'streaming') && (
                <div className="flex gap-4 animate-fade-in">
                  <div
                    className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: '#000000', fontSize: '16px' }}
                    >
                      auto_awesome
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div
                      className="text-xs font-medium text-neutral-500"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      CHATPDF AI
                    </div>
                    <div
                      className="p-4 flex items-center gap-1"
                      style={{
                        backgroundColor: '#161616',
                        borderRadius: '0 12px 12px 12px',
                      }}
                    >
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-neutral-400" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-neutral-400" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-neutral-400" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-6" style={{ backgroundColor: '#0a0a0a' }}>
              {uploadState !== 'done' && (
                <p className="text-neutral-600 text-xs text-center mb-3">
                  Upload a PDF first to enable chat
                </p>
              )}
              <div
                className="relative flex items-center rounded-lg p-1 transition-all duration-300"
                style={{
                  backgroundColor: '#111111',
                  border: '1px solid #2a2a2a',
                }}
                onFocusCapture={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#ffffff';
                }}
                onBlurCapture={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a';
                }}
              >
                <input
                  ref={chatInputRef}
                  id="chat-input"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={status !== 'ready' || uploadState !== 'done'}
                  placeholder={
                    uploadState !== 'done'
                      ? 'Upload a PDF to start chatting…'
                      : 'Ask anything about your document…'
                  }
                  className="flex-1 bg-transparent border-none text-white text-sm py-3 px-4 disabled:cursor-not-allowed"
                  style={{ outline: 'none', color: uploadState !== 'done' ? '#4a4a4a' : '#fff' }}
                />
                <button
                  id="send-btn"
                  onClick={handleSend}
                  disabled={status !== 'ready' || uploadState !== 'done' || !inputValue.trim()}
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled)
                      e.currentTarget.style.backgroundColor = '#e5e5e5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    north
                  </span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
