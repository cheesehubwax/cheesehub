# CHEESEDao rules

- Import DAO logic from `@/lib/dao` (stable entry point re-exporting daoModel, daoFees, daoActions, daoReads); keep transaction builders pure so `src/test/daoActions.test.ts` pins every signed action shape.
- Create DAO validation and transaction assembly live in `@/lib/daoCreate`; the screen only owns form state and toasts, so payment-leg order (fee, assertpoint, WAXDAO fee, createdao, optional setprofile) stays testable.
- DaoDetail owns data loading, refresh timing and vote handling; DaoInfoSection, DaoProposalList and DaoTreasurySection stay presentational.
- dao.waxdao::createdao requires proposal_cost in WAX; non-token DAOs use the "0,NULL"/"null" token sentinels.
