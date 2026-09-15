import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, setRememberMe, supabase } from './lib/supabaseClient'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  pendingEmail: string | null
  // Step 1 of register: sends the 6-digit code to the given email.
  sendCode: (fullName: string, email: string, rememberMe: boolean) => Promise<void>
  // Step 2 of register: checks the code the user typed in.
  verifyCode: (code: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [pendingName, setPendingName] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function sendCode(fullName: string, email: string, rememberMe: boolean) {
    if (!supabase) throw new Error('Supabase is not configured yet.')
    setRememberMe(rememberMe)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { full_name: fullName },
      },
    })
    if (error) throw error
    setPendingEmail(email)
    setPendingName(fullName)
  }

  async function verifyCode(code: string) {
    if (!supabase) throw new Error('Supabase is not configured yet.')
    if (!pendingEmail) throw new Error('No email is waiting for a code. Please start over.')
    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: code,
      type: 'email',
    })
    if (error) throw error
    // Make sure the profile's name is up to date (in case they already existed).
    if (data.user && pendingName) {
      await supabase
        .from('profiles')
        .update({ full_name: pendingName })
        .eq('id', data.user.id)
    }
    setPendingEmail(null)
    setPendingName(null)
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        configured: isSupabaseConfigured,
        pendingEmail,
        sendCode,
        verifyCode,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
