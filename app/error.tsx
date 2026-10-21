'use client'
import RecoveryPage from '@/components/RecoveryPage'
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) { return <RecoveryPage kind="error" retry={retry} /> }
