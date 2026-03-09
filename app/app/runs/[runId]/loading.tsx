import { AppPageLoading, DetailSplitLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <AppPageLoading descriptionWidth="w-full max-w-xl" titleWidth="w-72">
      <DetailSplitLoading />
    </AppPageLoading>
  )
}
