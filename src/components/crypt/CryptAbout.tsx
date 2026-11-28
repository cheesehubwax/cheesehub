import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DappAbout } from '@/components/about/DappAbout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function CryptographyDetails() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-sm font-semibold text-cheese underline underline-offset-2" aria-label="Read about TweetNaCl cryptography">
          TweetNaCl cryptography
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-cheese">CHEESECrypt cryptography</DialogTitle>
          <DialogDescription>
            TweetNaCl is an independently audited JavaScript port of NaCl, the cryptography library developed by Daniel J. Bernstein and collaborators. That library audit is not an audit of CHEESECrypt itself.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">The cryptographic stack</h3>
            <p>CHEESECrypt uses TweetNaCl’s nacl.box: Curve25519 key agreement with XSalsa20 encryption and Poly1305 authentication. Curve25519 is also used in systems such as Signal, WireGuard and modern SSH, but those systems do not use this exact messaging protocol or necessarily the same complete cipher suite.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Key agreement — Curve25519 / X25519</h3>
            <p>Each account has a 32-byte public/private key pair. Curve25519 provides roughly 128-bit classical security, often compared with 3072-bit RSA. Brute-force attacks are not practical with known classical computing methods; this is not a guarantee against every possible attack or future quantum computers.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Encryption — XSalsa20</h3>
            <p>A 256-bit stream cipher encrypts the message content. Every message chunk, including each group recipient’s separate copy, gets a fresh random 24-byte (192-bit) nonce using nacl.randomBytes(24). The nonce is public, not a secret. Its size makes accidental collisions extraordinarily unlikely, not mathematically impossible; nonce reuse with the same shared key must be avoided.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Integrity and authentication — Poly1305</h3>
            <p>Each encrypted chunk carries a 16-byte (128-bit) authentication tag. Decryption checks that tag and rejects altered or invalid ciphertext. This authenticates possession of the shared key, not a person’s real-world identity; verify that a friend’s public key genuinely belongs to their account.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Private content versus public activity</h3>
            <dl className="space-y-3">
              <div><dt className="font-medium text-foreground">Encrypted</dt><dd>Message text and chunk contents, including voice recordings and shared NFT references; group membership metadata inside the encrypted group envelope.</dd></div>
              <div><dt className="font-medium text-foreground">Public on WAX</dt><dd>Sender and recipient accounts, transaction timestamps and IDs, any CHEESE amounts paid, the encrypted message data (in a transfer memo for paid messages, or inside the crypt.cheese action for free messages) and chunk counts. A group’s recipient fanout can reveal likely participants even though the membership envelope is encrypted.</dd></div>
              <div><dt className="font-medium text-foreground">Avatars and key files</dt><dd>Avatars are not included in encrypted message memos. They are shared through public-key JSON files and saved locally by contacts. Public keys may also be published on-chain; private keys must never be shared.</dd></div>
            </dl>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Important security limits</h3>
            <p>Observers, block producers and history services cannot normally decrypt the content without the relevant keys. However, recipients can copy or share plaintext, and a compromised device, malicious browser extension or exposed private key can reveal messages. Keys must be locked to their owning WAX account with Anchor before use. Only the locked envelope is saved; the opened secret stays in this browser session’s memory. Legacy plain backups must be upgraded, and old copies deleted by you. Keep your locked backup and access to the same Anchor signing key: a changed wallet signing key may not unlock an older backup.</p>
            <p><strong className="font-medium text-foreground">Key rotation and forward secrecy:</strong> CHEESECrypt does not use automatic per-message ephemeral ratchets like Signal. It provides epoch-based forward secrecy through key rotation: once you rotate your key and destroy the retired copy, later compromise of your active key cannot decrypt messages from that retired epoch. Because ciphertext stays on the WAX blockchain permanently, past messages remain readable for as long as the matching keys still exist — so a friend who has not rotated, or who still keeps the old key, can still have that part of the history exposed, and retired keys you keep in your locked backup to read history stay exposed until you destroy them.</p>
            <p>Group members receive separate encrypted copies. Protect your device and backups, and keep a safe copy of any key you still need to read history — losing it can make those messages unreadable.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const P = 'pl-3.5 text-sm leading-relaxed text-muted-foreground';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cheese" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className={`${P} ml-4 list-disc space-y-1 marker:text-cheese`}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function B({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Grid({ label, head, rows }: { label: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="ml-3.5 overflow-x-auto rounded-md border border-cheese/20">
      <table className="w-full min-w-[560px] border-collapse text-xs" aria-label={label}>
        <thead className="bg-cheese/10">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-2 py-2 text-left font-semibold text-cheese">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-cheese/10">
              {row.map((cell, j) => j === 0
                ? <th key={j} scope="row" className="px-2 py-2 text-left font-medium text-foreground">{cell}</th>
                : <td key={j} className="px-2 py-2 text-muted-foreground">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Y = <span aria-label="Yes">✅</span>;
const N = <span aria-label="No">❌</span>;
const REPORT_URL = 'https://t.me/cheeseonwaxofficial';

function AboutBody() {
  return (
    <>
      <Section title="🚀 Getting started">
        <Bullets items={[
          <>Connect with Anchor and create a messaging key (one-time 500 CHEESE), or load an existing key file for free.</>,
          <>Every key is locked to your WAX account with Anchor before use — unlocking is a free signature.</>,
          <>Add friends by swapping public key files. Share your public key only, never your private key.</>,
          <>Keep your locked backup and your Anchor key safe: a lost key means old messages can't be read.</>,
          <>Move device copies your key, friends and groups to another device by QR code — nothing goes on chain or to a server.</>,
        ]} />
      </Section>

      <Section title="💬 Chats & rooms">
        <Grid
          label="Chat types compared"
          head={['', 'Private chat', 'Private group', 'Public room']}
          rows={[
            ['Who', 'You and one friend', 'Up to 8 people', 'Up to 50 people'],
            ['Joining', 'Add each other as friends', 'Invite from the creator', 'Ask to join; the owner admits you'],
            ['Listed publicly', 'No', 'No', 'Room name and owner only'],
            ['Earlier messages', 'Whole conversation', 'Not for newcomers', 'Not for newcomers'],
          ]}
        />
        <Bullets items={[
          <>Public Inbox (off by default) lets strangers send requests you can Accept, Decline or Block for free.</>,
          <>Publishing your key lets anyone find you — we recommend sharing it privately instead.</>,
        ]} />
      </Section>

      <Section title="✨ Messaging features">
        <Bullets items={[
          <><B>Replies & edits:</B> quote any message; edit your own for 24 hours. The blue @ jumps to unseen replies.</>,
          <><B>Reactions:</B> 👍 ❤️ 🔥 😂 🧀 🚀 💩, encrypted so only the chat sees them.</>,
          <><B>Voice notes:</B> up to 10 seconds, encrypted in your browser; plays only once fully received.</>,
          <><B>NFTs:</B> share pictures, music and sound effects from your own WAX wallet.</>,
          <><B>YouTube:</B> links stay encrypted; videos load only when you press ▶️ Play, through private mirrors first.</>,
          <><B>Direct wallet-to-wallet tips:</B> reply with /tip 100 cheese to tip the author directly — no intermediary holds your CHEESE.</>,
          <><B>Search, names & avatars:</B> search runs on your screen only; set a name, pixel avatar and private nicknames.</>,
          <><B>Instant Messaging:</B> sends free messages without Anchor popups using a restricted WharfKit session key — no transfers. Kept only in this tab, cleared on panic lock and expired after four idle hours; setup requires Anchor approval.</>,
        ]} />
      </Section>

      <Section title="🛡️ Privacy & security">
        <p className={P}>Message content is protected with <CryptographyDetails />.</p>
        <Bullets items={[
          <><B>Private:</B> message text, voice, shared NFT IDs and group details.</>,
          <><B>Public forever on WAX:</B> who sent to whom, when, fees paid and number of parts.</>,
          <>Every part is padded to the same size, so a short "ok" looks like a long message.</>,
          <>✔ means in a block, ✔✔ means permanent.</>,
          <>Verify compares a safety number with a friend to prove no one is impersonating either of you. Once marked verified, a ⚠️ warning appears if their key ever changes.</>,
          <><B>Screen shield:</B> blurs chats when you switch tabs or minimise; returning restores the view without unlocking again.</>,
          <><B>Panic lock:</B> Lock now, Esc twice, or Ctrl/Cmd+Shift+L clears decrypted chats and session keys, then signs you out. Idle auto-lock does the same; unlock your saved key with Anchor to return.</>,
          <><B>Random send delay (jitter):</B> adds a cancellable random pause within your chosen range, making reply timing less predictable — per chat or all chats.</>,
          <>Scheduled sends hold a message until a time you pick, once you confirm the delay.</>,
          <>Key rotation privately refreshes your messaging key and manages the old keys you keep.</>,
          <>Nightcrawler Companion runs a local off-hours schedule from an isolated signing key you set up in the Privacy menu.</>,
          <><B>Tor helper:</B> locally routes supported history, account checks, NFT media and transaction requests through Tor, hiding your IP from those services. Separate circuits reduce linking; protected requests stop if the helper is down, never silently switching to direct connections.</>,
          <><B>Fewer metadata leaks:</B> account-blind live polling, 24-hour Respect caching with decoy queries, and paused balance, ad and music scans reduce exposure. Tor does not hide public WAX activity or requested account/NFT IDs; Anchor’s own connections remain separate.</>,
          <>Anyone you message can still copy or share it, and a compromised device can expose your messages.</>,
        ]} />
      </Section>

      <Section title="🧀 Respect">
        <Bullets items={[
          <>A quick public-data signal shown next to strangers, join requests and group members.</>,
          <>Rewards real involvement in CHEESE: liquidity (weighted highest), holdings, faucet staking, NFTs, account and key age, and .cheese/.chz names.</>,
          <>Six marks, from 🪤 Warning to 🏆 Huge Respect. A * means some data couldn't be read.</>,
          <>Others only see your total; tap your own badge to see your breakdown.</>,
          <>It never confirms who someone is — use your own judgement.</>,
        ]} />
      </Section>

      <Section title="👑 Public room moderation">
        <p className={P}>👑 Owner → 🛡️ Admin → Member. <span className="font-semibold text-cheese">⭐ Founder</span> is a permanent badge for members present when a room is first listed (up to 8, owner included). Right-click or long-press a message for commands.</p>
        <Grid
          label="What each role can do"
          head={['Action', '👑 Owner', '🛡️ Admin', '⭐ Founder', 'Member']}
          rows={[
            ['Admit members, list or unlist', Y, N, N, N],
            ['Appoint admins', Y, N, N, N],
            ['Mute (15m–24h)', 'Anyone', 'Not the owner', N, N],
            ['Collapse a message', 'Anyone’s', 'Not owner’s or founders’', N, N],
            ['Ban', 'Not founders', N, N, N],
            ['🚩 Report a message', '—', 'To owner', 'To owner + admins', 'To owner + admins'],
            ['See the 72-hour edit log', Y, N, N, N],
          ]}
        />
        <Bullets items={[
          <>Messages sent during a mute stay hidden for good. Collapsed messages hide behind a notice.</>,
          <>A ban stops future messages; it can't take back what was already received.</>,
          <>Every app checks these rules itself, so no one can grant themselves powers.</>,
        ]} />
      </Section>

      <Section title="💰 Costs">
        <Grid
          label="Costs"
          head={['Action', 'Cost']}
          rows={[
            ['Text, replies, reactions, NFTs, links', 'Free while the shared daily budget lasts'],
            ['Paid message part', '0.0100 CHEESE fee + 0.0001 per recipient'],
            ['Voice note', 'Same as a paid part, per part'],
            ['Join or rejoin request', '0.0101 CHEESE'],
            ['Messaging key', '500 CHEESE once'],
            ['Publish your key', '0.0100 CHEESE'],
            ['List a public room (admins only)', '100 CHEESE non-refundable fee'],
          ]}
        />
        <Bullets items={[
          <>Fees are split 80% nulled, 20% to xcheeseliqst, and pass straight through crypt.cheese — it never holds your CHEESE.</>,
          <>Anchor Fuel is off on CHEESECrypt for privacy, so you need your own CPU. Short? Rent some with <Link to="/powerup" className="text-cheese underline">CHEESEUp</Link>.</>,
        ]} />
      </Section>

      <Section title="⚖️ Your responsibility">
        <Bullets items={[
          <>You are responsible for what you send, publish or list, and for following your local laws.</>,
          <>CHEESEHub is software only: it can't read, store, delete or recover your messages or keys.</>,
          <>Report a public room with 🚩 Report, in the <a href={REPORT_URL} target="_blank" rel="noopener noreferrer" className="text-cheese underline">CHEESE Telegram group</a>, or at <a href="mailto:cheesehub@protonmail.com" className="text-cheese underline">cheesehub@protonmail.com</a>.</>,
          <>Read the full <Link to="/terms" className="text-cheese underline">Terms of Use</Link>.</>,
        ]} />
      </Section>
    </>
  );
}

export function CryptAbout({ children }: { children: ReactNode }) {
  return (
    <DappAbout
      title="CHEESECrypt"
      introduction="Encrypted messaging on WAX for friends, private groups and public rooms. Only your chat can read what you say; who messaged whom and when stays public on chain."
      sections={[]}
      extra={<AboutBody />}
    >
      {children}
    </DappAbout>
  );
}
