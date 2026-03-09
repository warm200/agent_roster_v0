import { AppPageLoading, ListLoading, StatGridLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <AppPageLoading>
      <StatGridLoading />
      <ListLoading rows={4} />
    </AppPageLoading>
  )
}
