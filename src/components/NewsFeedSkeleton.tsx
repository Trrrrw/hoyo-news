export default function NewsFeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="news-feed" aria-busy="true" aria-label="正在加载新闻列表">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="news-row news-row-skeleton">
          <div className="news-thumb">
            <div className="news-cover skeleton-block" />
          </div>
          <div className="news-body">
            <div className="flex items-center gap-2">
              <div className="skeleton-block h-4 w-11 rounded" />
              <div className="skeleton-block h-4 w-28 rounded" />
            </div>
            <div className="skeleton-block mt-2.5 h-5 w-4/5 rounded" />
            <div className="skeleton-block mt-2 h-4 w-3/5 rounded" />
            <div className="mt-3 flex gap-2">
              <div className="skeleton-block h-5 w-16 rounded" />
              <div className="skeleton-block h-5 w-14 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
