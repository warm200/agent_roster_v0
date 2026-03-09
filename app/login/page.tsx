import { LoginPageClient } from '@/components/login-page-client'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const params = await searchParams

  return <LoginPageClient callbackUrl={params.callbackUrl || '/app'} />
}
