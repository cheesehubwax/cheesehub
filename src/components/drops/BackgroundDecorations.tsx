import cheeseLogo from "@/assets/cheese-logo.png";

export function BackgroundDecorations() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Gradient orbs - warm cheese tones */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brown/20 rounded-full blur-3xl" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--cream)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--cream)) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating cheese logos */}
      <img src={cheeseLogo} alt="" className="absolute top-20 left-20 w-12 h-12 opacity-20 animate-float" />
      <img src={cheeseLogo} alt="" className="absolute top-40 right-32 w-10 h-10 opacity-15 animate-float" style={{ animationDelay: "2s" }} />
      <img src={cheeseLogo} alt="" className="absolute bottom-32 left-40 w-16 h-16 opacity-10 animate-float" style={{ animationDelay: "4s" }} />
      <img src={cheeseLogo} alt="" className="absolute bottom-20 right-20 w-12 h-12 opacity-20 animate-float" style={{ animationDelay: "3s" }} />
    </div>
  );
}
