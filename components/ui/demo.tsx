import HoverPlayCard from "~/components/ui/hover-play-card";

export default function DemoOne() {
  return (
    <HoverPlayCard
      src="https://www.pexels.com/download/video/29913691/"
      poster="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80"
      title="Video preview demo"
      className="aspect-video max-w-xl"
    />
  );
}
