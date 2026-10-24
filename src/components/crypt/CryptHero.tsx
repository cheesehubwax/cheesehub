// The orb uses a bundled public copy on GitHub Pages, which cannot serve Lovable's asset paths.
import { OpenMojiIcon } from '@/components/OpenMojiIcon';
import cryptOrbAsset from '@/assets/cheesecrypt-relic.png.asset.json';
import { CryptAbout } from '@/components/crypt/CryptAbout';
import { playRandomFart } from '@/lib/fartSounds';

/** CHEESECrypt page heading: floating orb, antique-key title with About, and intro text. */
export function CryptHero() {
  return (
    <section className="relative pt-20 pb-14 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
      <div className="container relative z-10">
        <div className="flex flex-col items-center gap-8">
          <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
            <img src={import.meta.env.PROD ? `${import.meta.env.BASE_URL}cheesecrypt-relic.png` : cryptOrbAsset.url} alt="CHEESE" className="h-24 w-24 object-contain" />
          </div>
          <div className="w-full text-center space-y-4">
            <CryptAbout>
            <div className="flex items-center justify-center gap-2">
              <OpenMojiIcon emoji="🗝️" size={26} tint="hsl(var(--cheese))" />
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Crypt</span>
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
              <OpenMojiIcon emoji="🗝️" size={26} tint="hsl(var(--cheese))" />
            </div>
            </CryptAbout>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Encrypted messages sent on the WAX blockchain with CHEESE. Anyone can see that a message was sent —
              only the conversation’s participants can read it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
