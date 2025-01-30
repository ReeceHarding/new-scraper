import { useEffect, useState } from 'react'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'

export default function Home() {
  const supabase = useSupabaseClient()
  const user = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin')
    }
  }, [user, router])

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dashboard cards will go here */}
      </div>
    </main>
  )
} 