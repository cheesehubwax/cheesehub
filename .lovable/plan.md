

## Strengthen Disclaimer to Align with Recent Terms of Use Additions

### Context
The Disclaimer (`src/pages/Disclaimer.tsx`) is already comprehensive but has gaps compared to the newly strengthened Terms of Use. Several concepts added to the Terms should be mirrored or reinforced in the Disclaimer for consistency and stronger legal positioning.

### Gaps Found

| Area | Terms Coverage | Disclaimer Gap |
|------|---------------|----------------|
| Corporations Act 2001 reference | Explicit in new section 3 | Not mentioned — section 5 says "no licence" but doesn't reference the Act |
| "Not managed staking / staking-as-a-service" | Explicit in new section 5 | Section 8 implies it but never uses the term |
| AML/KYC clarification | Explicit in new section 14 | Not mentioned anywhere |
| Gambling ad prohibition | Explicit in Terms section 10 | CHEESEAds subsection (7.3) content policy doesn't mention gambling |
| Australian Consumer Law | Explicit in Terms section 12 | CHEESEDrop (7.7) says "consumer protection laws" but doesn't name ACL |
| Regulatory/legal risk | Terms risk warnings include it | Section 11 risk warnings omit regulatory risk |
| "Not a security, MIS, derivative, or non-cash payment facility" | Explicit in Terms section 3 | Section 2 says "not a security, financial product..." but doesn't list MIS, derivative, NCPF specifically |

### Proposed Changes to `src/pages/Disclaimer.tsx`

**Section 2 (Nature of CHEESE):**
- Add explicit list: "not a security, managed investment scheme, derivative, non-cash payment facility, or regulated instrument within the meaning of the Corporations Act 2001 (Cth) or equivalent legislation in any other jurisdiction"

**Section 5 (Financial Services):**
- Add reference to Corporations Act 2001 (Cth)
- Add: "CHEESEHub does not perform KYC (Know Your Customer) or AML/CTF (Anti-Money Laundering / Counter-Terrorism Financing) checks, as it is a non-custodial, non-intermediary frontend that does not hold, transmit, or control user funds"

**Section 7.3 (CHEESEAds Content Policy):**
- Add gambling to the prohibited content list: "gambling services, crypto casinos, betting platforms, lotteries, or any other form of wagering"

**Section 7.7 (CHEESEDrop):**
- Change "consumer protection laws" to explicitly reference "the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) and equivalent consumer protection legislation in other jurisdictions"

**Section 8 (Liquidity Provision & Farming):**
- Add explicit statement: "This is not managed staking, staking-as-a-service, or a managed investment arrangement. CHEESEHub does not pool user funds or exercise any discretion over staking or farming activities"

**Section 11 (Risk Warnings):**
- Add new bullet: "Regulatory risk — laws and regulations governing digital assets may change in any jurisdiction, potentially affecting the legality, value, or availability of tokens and platform features"
- Add new bullet: "Counterparty and protocol risk — third-party smart contracts and services integrated via CHEESEHub are independently operated and may fail, be exploited, or cease operations without notice"

### Files Changed: 1
- `src/pages/Disclaimer.tsx`

