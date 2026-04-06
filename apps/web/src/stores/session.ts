'use client'

import { create } from 'zustand'
import type { MockSession } from '@/lib/auth'

type SessionStore = {
  session: MockSession | null
  setSession: (session: MockSession | null) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}))
