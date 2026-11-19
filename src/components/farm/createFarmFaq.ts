// Farm Creation Guide entries; the last item is the Anchor warning the form links to.
export const FAQ_ITEMS = [
  {
    question: "Can I pay with CHEESE tokens?",
    answer: "Yes! You can pay with CHEESE tokens and receive a 20% discount on the creation fee. Simply select the CHEESE option and the transaction will handle the conversion automatically in a single step.",
  },
  {
    question: "What is the correct format for my farm name?",
    answer: "Farm names must be 12 characters or less and can only contain lowercase letters (a-z), numbers (1-5), and periods. Names cannot start or end with a period, and cannot contain consecutive periods.",
  },
  {
    question: "How much does it cost to create a farm?",
    answer: "You can create a farm by paying 265 WAX or by paying with CHEESE tokens at a 20% discount. Simply select your preferred payment method before submitting.",
  },
  {
    question: "What are the different farm types?",
    answer: "Collections: stake any NFT from specified collections. Schemas: stake NFTs from specific schemas within collections. Templates: stake specific template IDs. Attributes: stake NFTs with matching attribute key/value pairs.",
  },
  {
    question: "How do I add stakable assets after creation?",
    answer: "After creating your farm, you need to add stakable assets (collections, schemas, templates, or attributes) using separate actions. Visit your farm's detail page to configure which NFTs can be staked.",
  },
  {
    question: "Is there a limit to how many NFTs can be staked?",
    answer: "There is no hard limit on the number of NFTs that can be staked in a V2 farm. However, you should ensure you have enough reward tokens deposited to cover payouts for all stakers.",
  },
  {
    question: "Can I have multiple reward tokens?",
    answer: "Yes! V2 farms support up to 3 different reward tokens. You can configure different tokens when creating the farm, allowing you to reward stakers with multiple tokens simultaneously.",
  },
  {
    question: "How often are rewards paid out?",
    answer: "Rewards accumulate continuously based on the hourly rate you set. The 'Hours Between Payouts' setting determines the minimum interval between claim transactions. Enter a number between 1 and 720 hours.",
  },
  {
    question: "Are staked NFTs safe?",
    answer: "V2 farms are non-custodial - NFTs remain in your wallet while staked. The smart contract only tracks which NFTs are registered for rewards. WaxDAO has been audited and running since 2021.",
  },
  {
    question: "What are the IPFS hash fields for?",
    answer: "Avatar Image is a small profile picture (e.g. 300x300px). Cover Image is a large background banner. Both should be IPFS hashes only (e.g. QmXxx...), not full URLs. Supported formats: JPEG and PNG.",
  },
  {
    question: "Why does Anchor show a 'Dangerous Transaction' warning?",
    answer: "This transaction includes inline actions from the cheesefeefee smart contract — it sends WAXDAO tokens to your wallet and burns fees automatically. These are standard, safe operations and the contract is open source.\n\nTo proceed in Anchor Wallet:\n1. Tap the gear/settings icon\n2. Toggle 'Allow Dangerous Transactions' ON\n3. Sign the transaction\n4. Optionally toggle it back OFF afterward\n\nSome versions of Anchor also show an 'Allow for this transaction only' checkbox you can use instead.",
  },
];
