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
            <p>Observers, block producers and history services cannot normally decrypt the content without the relevant keys. However, recipients can copy or share plaintext, and a compromised device, malicious browser extension or exposed private key can reveal messages. Your private key is stored in this browser and in any backup files you save; those JSON backups are not password-encrypted.</p>
            <p>There is no forward secrecy: because the same long-term keys are reused and ciphertext remains on-chain, later compromise of either participant’s private key can expose past messages for that pair when the other public key is available. Group members receive separate encrypted copies. Protect your device and backups, and keep a safe copy of your private key—losing it can make old messages unreadable.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CryptAbout({ children }: { children: ReactNode }) {
  return (
    <DappAbout
      title="CHEESECrypt"
      introduction={<>Send private messages to friends or small groups on WAX, paid in CHEESE. Message text is protected with <CryptographyDetails />, while the transaction activity remains public.</>}
      sections={[
        { title: 'Get started', body: 'Connect your WAX wallet, create a messaging key or load your existing private key file, and keep a safe backup. Add a friend using their published public key or load their public key file. Share only your public key, never your private key.' },
        { title: 'Direct messages and groups', body: 'Choose a friend, write your message, review its cost, accept the Terms of Use and sign. Longer messages are split and shown as one conversation message. Start a group with 2–5 friends; each gets their own encrypted copy. Membership is fixed, so create a new group to change the people in it.' },
        { title: 'Costs and records', body: 'Each part costs 0.0010 CHEESE to each recipient plus 0.0100 CHEESE permanently nulled once, shared across the whole group. A three-person group costs 0.0120 CHEESE per part; direct messages remain 0.0110 CHEESE per part. Review the full total before signing. Group history shows the current rate, not proof of the fee paid on older transactions. The Tx link opens the public WAX transaction, not your readable message text.' },
        { title: 'Voice notes', body: 'Record up to 10 seconds, listen back, then send. The audio is encrypted in your browser and stored only as encrypted messages on WAX, never uploaded anywhere. A note is split into about 60–90 parts at the normal message rate, sent in up to 30 parts per transaction, so you sign 2–4 times and need enough CPU/NET. If a later transaction fails, the note shows as incomplete and never plays. Safari and iPhone may not support recording or playback; the button says so. The accounts and time are public, the audio is not.' },
        { title: 'Keep your key safe', body: 'Your private key unlocks messages and stays in this browser unless you export it. Back it up in your cheesecrypt folder or keep the downloaded file somewhere safe. A new key cannot read messages encrypted for an older key. Participants can share what they read, so only send content you trust them with.' },
      ]}
    >
      {children}
    </DappAbout>
  );
}