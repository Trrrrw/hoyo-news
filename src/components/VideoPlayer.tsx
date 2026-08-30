interface DirectVideoPlayerProps {
  src: string
}

interface YouTubeVideoPlayerProps {
  src: string
  title: string
}

/** 播放可直接访问的视频地址 */
export function DirectVideoPlayer({ src }: DirectVideoPlayerProps) {
  return <video src={src} controls preload="metadata" className="w-full rounded-lg bg-black" />
}

function getYoutubeVideoId(src: string): string | null {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return null
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null
  }

  const isYoutubeHost =
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtube-nocookie.com' ||
    hostname.endsWith('.youtube-nocookie.com')
  if (!isYoutubeHost) return null

  if (url.pathname === '/watch') return url.searchParams.get('v')

  const [, type, id] = url.pathname.split('/')
  return ['embed', 'shorts', 'live'].includes(type) ? id || null : null
}

function getYoutubeEmbedUrl(src: string): string {
  const videoId = getYoutubeVideoId(src)
  return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : src
}

/** 使用 YouTube 嵌入播放器播放视频 */
export function YouTubeVideoPlayer({ src, title }: YouTubeVideoPlayerProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={getYoutubeEmbedUrl(src)}
        title={title}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}
