import { AppPageLoading, ListLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <AppPageLoading>
      <ListLoading rows={4} />
    </AppPageLoading>
  )
}
