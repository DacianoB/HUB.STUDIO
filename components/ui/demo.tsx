import { VideoPlayer } from '~/components/ui/video-player';

export default function DemoOne() {
  return (
    <VideoPlayer
      src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      poster="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80"
      size="default"
      className="aspect-video max-w-xl"
      title="Video preview demo"
    />
  );
}
