import { AppPageLoading, DetailSplitLoading } from '@/components/page-loading'

export default function Loading() {
  return (
    <AppPageLoading descriptionWidth="w-96" titleWidth="w-72">
      <DetailSplitLoading />
    </AppPageLoading>
  )
}
