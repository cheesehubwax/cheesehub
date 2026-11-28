import cheeseLogo from "@/assets/cheese-logo.png";

export function BackgroundDecorations() {
  return (
    <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Static accents avoid full-screen grid rasterization and continuously blurred layers. */}
      <img src={cheeseLogo} alt="" className="absolute top-20 left-20 w-12 h-12 opacity-20" />
      <img src={cheeseLogo} alt="" className="absolute top-40 right-32 w-10 h-10 opacity-15" />
      <img src={cheeseLogo} alt="" className="absolute bottom-32 left-40 w-16 h-16 opacity-10" />
      <img src={cheeseLogo} alt="" className="absolute bottom-20 right-20 w-12 h-12 opacity-20" />
    </div>
  );
}
