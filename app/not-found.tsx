import { Header } from '@/components/header'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/70 p-8 text-center shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">404</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Page not found
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            The page you requested does not exist or is no longer available.
          </p>
        </div>
      </div>
    </div>
  )
}
