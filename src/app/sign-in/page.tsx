import { Suspense } from 'react'
import SignInForm from './sign-in-form'

export const metadata = { title: 'Sign in — Idea Engine' }

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center">Sign in</h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          We&apos;ll email you a magic link — no password needed.
        </p>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  )
}
