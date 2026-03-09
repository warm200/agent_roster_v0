import { CardGridLoading, PublicPageLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <PublicPageLoading descriptionWidth="w-96" titleWidth="w-64">
      <CardGridLoading cards={6} />
    </PublicPageLoading>
  )
}
