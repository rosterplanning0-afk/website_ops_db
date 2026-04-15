'use client'

import { useState } from 'react'
import { login } from '@/app/actions/auth'
import { IdCard, Lock } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8)),
            url('/images/login_page_background.jpg') center/cover no-repeat;
          font-family: 'Inter', sans-serif;
          margin: 0;
          padding: 0;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 2.5rem;
          border-radius: 16px;
          text-align: center;
          background: #ffffff;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-header {
          margin-bottom: 1.5rem;
        }

        .login-header .brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          color: #334155;
        }

        .login-header .brand img {
          height: 60px;
        }

        .login-header .brand .brand-title {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .login-header .subtitle {
          color: #64748b;
          margin-top: 0.25rem;
          font-size: 0.95rem;
        }

        .login-form .form-group {
          margin-bottom: 1.25rem;
          text-align: left;
        }

        .login-form input[type="email"],
        .login-form input[type="password"] {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          background-color: #f8fafc;
          color: #334155;
          transition: 0.15s ease-in-out;
          outline: none;
          box-sizing: border-box;
        }

        .login-form input:focus {
          border-color: #EC0016;
          box-shadow: 0 0 0 3px rgba(236, 0, 22, 0.15);
          background-color: #fff;
        }

        .login-form input::placeholder {
          color: #94a3b8;
        }

        .input-wrapper {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
        }

        .btn-signin {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 0.8rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1.05rem;
          cursor: pointer;
          transition: 0.15s ease-in-out;
          border: none;
          background-color: #EC0016;
          color: white;
          margin-top: 1rem;
          font-family: 'Inter', sans-serif;
        }

        .btn-signin:hover:not(:disabled) {
          background-color: #C50012;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }

        .btn-signin:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-footer {
          margin-top: 1.5rem;
          font-size: 0.85rem;
          color: #64748b;
          display: flex;
          justify-content: space-between;
        }

        .error-msg {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
          text-align: center;
        }

        @media (max-width: 768px) {
          .login-card {
            padding: 1.5rem;
            width: 90%;
          }
        }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/deutsche-bahn-logo.png" alt="DB Logo" />
              <span className="brand-title">Operations</span>
            </div>
            <p className="subtitle">(DB RRTS)</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="input-wrapper">
                <IdCard size={16} className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Employee ID"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="error-msg">
                {error}
              </div>
            )}

            <button type="submit" className="btn-signin" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="login-footer">
            <span>Ver 1.0</span>
          </div>
        </div>
      </div>
    </>
  )
}
