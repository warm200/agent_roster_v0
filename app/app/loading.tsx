import { AppPageLoading, ListLoading, StatGridLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <AppPageLoading>
      <StatGridLoading />
      <div className="grid gap-8 lg:grid-cols-2">
        <ListLoading rows={3} />
        <ListLoading rows={3} />
      </div>
    </AppPageLoading>
  )
}
