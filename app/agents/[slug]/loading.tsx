import { PublicPageLoading, DetailSplitLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <PublicPageLoading descriptionWidth="w-full max-w-2xl" titleWidth="w-72">
      <DetailSplitLoading />
    </PublicPageLoading>
  )
}
