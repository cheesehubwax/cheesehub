import type { ReactNode } from 'react';
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
              <div><dt className="font-medium text-foreground">Encrypted</dt><dd>Message text and chunk contents; group membership metadata inside the encrypted group envelope.</dd></div>
              <div><dt className="font-medium text-foreground">Public on WAX</dt><dd>Sender and recipient accounts, transaction timestamps and IDs, transfer amounts, encrypted memos and chunk counts. A group’s recipient fanout can reveal likely participants even though the membership envelope is encrypted.</dd></div>
              <div><dt className="font-medium text-foreground">Avatars and key files</dt><dd>Avatars are not included in encrypted message memos. They are shared through public-key JSON files and saved locally by contacts. Public keys may also be published on-chain; private keys must never be shared.</dd></div>
            </dl>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Important security limits</h3>
            <p>Observers, block producers and history services cannot normally decrypt the content without the relevant keys. However, recipients can copy or share plaintext, and a compromised device, malicious browser extension or exposed private key can reveal messages. Keys must be locked to their owning WAX account with Anchor before use. Only the locked envelope is saved; the opened secret stays in this browser session’s memory. Legacy plain backups must be upgraded, and old copies deleted by you. Keep your locked backup and access to the same Anchor signing key: a changed wallet signing key may not unlock an older backup.</p>
            <p>There is no forward secrecy: because the same long-term keys are reused and ciphertext remains on-chain, later compromise of either participant’s private key can expose past messages for that pair when the other public key is available. Group members receive separate encrypted copies. Protect your device and backups, and keep a safe copy of your private key—losing it can make old messages unreadable.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cheese" />
      {children}
    </h3>
  );
}

function Grid({ label, head, rows }: { label: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="ml-3.5 overflow-x-auto rounded-md border border-cheese/20">
      <table className="w-full min-w-[640px] border-collapse text-xs" aria-label={label}>
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

function ChatTypesAndRoles() {
  return (
    <>
      <section className="space-y-2">
        <Heading>Private chat, private group or public room?</Heading>
        <Grid
          label="Chat types compared"
          head={['', '💬 Private chat', '🔒 Private group', '📣 Public room']}
          rows={[
            ['Who', 'You and one friend', 'Up to 8 people, including the creator', 'Up to 50 people'],
            ['How people join', 'Add each other as friends', 'Invitation from the creator; Join or Decline', 'Ask to join from the public listing; the owner admits you'],
            ['Visible to outsiders', 'Only that two accounts traded transactions', 'Nothing is listed; transactions to members are still public', 'Room name and owner are listed on chain; members, admins, mutes and bans are never listed'],
            ['Moderation', 'Block the person', 'Leave, or block a member', 'Owner and admins: mute, collapse, ban, reports'],
            ['Earlier messages', 'Whole conversation', 'Newcomers do not see earlier messages', 'Newcomers do not see earlier messages'],
          ]}
        />
        <p className="pl-3.5 text-sm leading-relaxed text-muted-foreground">Messages stay in the chat they were sent to: group and room messages never appear in private chats, and private chats never appear in groups. A private group must be listed publicly to grow past 8. Everyone who was a member when the room was first listed becomes a permanent Founder.</p>
      </section>

      <section className="space-y-2">
        <Heading>Public room roles</Heading>
        <p className="pl-3.5 text-sm leading-relaxed text-muted-foreground">👑 Owner (room creator) → 🛡️ Admin (appointed by the owner) → 👤 Member. <span className="font-semibold text-cheese">⭐ Founder</span> is an extra badge, not a rank: the owner, admins and members can all be founders, and a founder who also holds the owner or admin rank uses that rank's commands. Commands appear when you right-click (or long-press) a message, and badges show beside names in the chat.</p>
        <Grid
          label="What each role can do"
          head={['Action', '👑 Owner', '🛡️ Admin', '⭐ Founder', '👤 Member']}
          rows={[
            ['List, unlist and admit members', Y, N, N, N],
            ['Make or remove admins', Y, N, N, N],
            ['Mute (15m, 1h, 6h, 24h)', 'Anyone', 'Anyone except the owner', N, N],
            ['Collapse a message', 'Anyone’s', 'Not the owner’s or a founder’s', N, N],
            ['Ban', 'Anyone except founders', N, N, N],
            ['🚩 Report a message', 'Not needed — can act directly', 'Reports go to the owner', 'Reports go to the owner and admins', 'Reports go to the owner and admins'],
            ['See reports (orange 🚩 button)', Y, Y, N, N],
            ['See the 72-hour edit log', Y, N, N, N],
            ['Edit own messages (24 hours)', Y, Y, Y, Y],
          ]}
        />
        <Grid
          label="Who is protected from what"
          head={['Protection', '👑 Owner', '🛡️ Admin', '⭐ Founder', '👤 Member']}
          rows={[
            ['Can be muted', N, 'Yes, by the owner or another admin', 'Yes, by the owner or admins', 'Yes, by the owner or admins'],
            ['Messages can be collapsed', N, 'By the owner only', 'Only by the owner', 'By the owner or admins'],
            ['Can be banned', N, 'Yes, by the owner', N, 'Only by the owner'],
          ]}
        />
        <p className="pl-3.5 text-sm leading-relaxed text-muted-foreground">A muted person’s messages from that time stay hidden for everyone, even after the mute ends. Collapsed messages are hidden behind a notice that moderators can open. A ban stops future messages reaching that person; it cannot take back messages they already received. Muted or banned admins lose their powers while it applies. Every app checks these rules itself against the signed WAX sender, so no one can give themselves powers by changing their own app.</p>
      </section>
    </>
  );
}

export function CryptAbout({ children }: { children: ReactNode }) {
  return (
    <DappAbout
      title="CHEESECrypt"
      introduction={<>Send private messages to friends, private groups or public rooms on WAX, paid in CHEESE. Message text is protected with <CryptographyDetails />, while the transaction activity remains public.</>}
      sections={[
        { title: 'Get started', body: 'Connect with Anchor, choose your profile and create a messaging key for 100 CHEESE (80 to eosio.null, 20 to xcheeseliqst), or load your existing private key file for free. Every key must be locked to its WAX account before use; legacy keys are upgraded without changing friends or rooms. Anchor requests two free, never-broadcast signatures for locking, or one to open a locked backup. Keep your locked backup and Anchor signing key safe. Add a friend using their published public key or load their public key file. Share only your public key, never your private key.' },
        { title: 'Publishing and the Public Inbox', body: 'Publishing (Menu → Publish) puts your account and public key permanently on chain so others can find you; it costs 0.0100 CHEESE. (CHEESECrypt recommends you do not publish your public key and instead share it privately and directly with friends) This feature benefits public figures who wish to be found and contactable. Public Inbox is off by default. Turn it on and strangers can send text or NFT message requests that you Accept, Decline or Block for free. Blocked accounts are ignored and you never see their messages.' },
        { title: 'Messaging features', body: 'Longer messages are split and shown as one message. Reply to a message to quote it; the blue @ button jumps to replies you have not seen. You can edit your own messages for 24 hours; edited messages are marked (edited). Set a name and pixel avatar in your profile and give friends private nicknames. When the side panel is collapsed, a thin strip keeps every room and friend with their unread counts in view.' },
      ]}
      extra={<>
        <ChatTypesAndRoles />
        {[
          { title: 'Costs and records', body: 'Each part costs 0.0001 CHEESE to each recipient plus a 0.0100 CHEESE platform fee once, shared across the whole group. A three-person group costs 0.0102 CHEESE per part; direct messages remain 0.0101 CHEESE per part. Asking to join or rejoin a public room costs 0.0101 CHEESE, the same as an ordinary one-part direct message: 0.0001 CHEESE with the request and a shared 0.0100 CHEESE platform fee, with no extra owner payment. Making a room public costs a 100.0000 CHEESE listing fee to deter throwaway spam listings; updating a listed room’s details or unlisting costs only the usual 0.0100 CHEESE. Room actions such as mutes, bans, admin changes and reports are sent as messages and cost the same. All platform fees split 80% to eosio.null and 20% to xcheeseliqst; recipient payments stay separate. Text, NFTs, YouTube links and voice all use the same platform rate per part. Amounts no longer explicitly price content types, but part counts, ciphertext sizes, requester keys and recipient patterns can still distinguish activity. Review the full total before signing. History shows the current rate, not proof of the fee paid on older transactions. The Tx link opens the public WAX transaction, not your readable message text.' },
          { title: 'Voice notes', body: 'Record up to 10 seconds, listen back, then send. The audio is encrypted in your browser and stored only as encrypted messages on WAX. Every encrypted voice part costs the ordinary 0.0100 CHEESE shared platform fee (0.0080 nulled, 0.0020 to xcheeseliqst), plus 0.0001 CHEESE to each recipient. A 30-part batch costs 0.3000 CHEESE in platform fees, or 0.3030 CHEESE total for one recipient; the whole note costs according to its actual part count. A note is sent in up to 30 parts per transaction, so you sign 2–4 times and need enough CPU/NET. If a later transaction fails, the note shows as incomplete and never plays. Safari and iPhone may not support recording or playback.' },
          { title: 'Music NFTs', body: 'Use 🖼️ Attach NFT to share an NFT from your wallet, including songs, clips, sound effects or video. Only the NFT ID travels inside your encrypted message; the media is public on WAX. Only one sound plays at a time.' },
          { title: 'Keep your key safe', body: 'Your private key unlocks messages and stays in this browser unless you export it. Back it up in your cheesecrypt folder or keep the downloaded file somewhere safe. A new key cannot read messages encrypted for an older key. Participants can share what they read, so only send content you trust them with.' },
        ].map((s) => (
          <section key={s.title} className="space-y-2">
            <Heading>{s.title}</Heading>
            <p className="pl-3.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </>}
    >
      {children}
    </DappAbout>
  );
}