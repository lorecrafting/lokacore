# Specification import record (R2 cutover)

Imported 2026-09-24 from [lorecrafting/lokacore-v2-legacy](https://github.com/lorecrafting/lokacore-v2-legacy/tree/997a7a8/docs/rewrite-v3) at commit `997a7a8`.
Every imported file is byte-identical between the R0-accepted commit `f5bef28` and
`997a7a8` (`git diff f5bef28 997a7a8` over these paths is empty).

From this cutover on, this repository is the source of truth for specification and ADR
amendments (spec [README §12](README.md#12-r0-cutover-and-implementation-facing-specification-organization)).
The legacy packet is provenance only; never amend it or choose it over these files.

## Authority layout

- `docs/spec/`: normative architecture, content pull list, gates and sequencing, and
  their companions and reading aids. The authority map is spec [README §8](README.md#8-specification-authority-map).
  The directory stays flat so the packet's relative links keep working.
- [docs/decisions/](../decisions/README.md): proposed ADRs and verbatim owner decisions
  made after R0.
- [docs/reference/](../reference/README.md): informative documents and evidence, left in
  the legacy repository and linked there. Not authority.

## Link rewrites (the only byte changes)

A relative Markdown link whose target was also imported now points at the imported
copy. A relative link to a legacy file that was not imported now points at that file
at `997a7a8` on GitHub. Nothing else changed. `rewrites` counts changed links.
`r1-acceptance-envelope.md` was a hashed preserved input; its source hash is below.

| Imported file | Legacy source | SHA-256 of source at `997a7a8` | rewrites |
| --- | --- | --- | --- |
| [decisions/adr-071-072-proposal.md](../decisions/adr-071-072-proposal.md) | `docs/rewrite-v3/prep/adr-071-072-proposal.md` | `c7c46570b47b13e97a2494433860ea378101ee6a9d1a22bb5785f5e8c51dfa42` | 5 |
| [decisions/owner-decision-a2-2026-09-23.md](../decisions/owner-decision-a2-2026-09-23.md) | `docs/rewrite-v3/prep/after-pr-10/owner-decision-a2-2026-09-23.md` | `40b33035646008135795c4e8d10f487397fb138e55df88397aa15b6246b68f2a` | 2 |
| [decisions/owner-decision-a3-2026-09-24.md](../decisions/owner-decision-a3-2026-09-24.md) | `docs/rewrite-v3/prep/after-pr-10/owner-decision-a3-2026-09-24.md` | `69981f5ecba046a18d243509c7157be9562b2e0c580013e460a40ce23c781d0a` | 0 |
| [decisions/owner-decision-prep-03-2026-09-24.md](../decisions/owner-decision-prep-03-2026-09-24.md) | `docs/rewrite-v3/prep/owner-decision-prep-03-2026-09-24.md` | `6bf1d6f8ec5b40fb46620d789d33a00875d2eedfe1248584f7aa4cf34489dd6c` | 1 |
| [decisions/owner-decision-reviewers-2026-09-24.md](../decisions/owner-decision-reviewers-2026-09-24.md) | `docs/rewrite-v3/prep/owner-decision-reviewers-2026-09-24.md` | `8b84a1b3f0aebfd517de8bac737a971744c20ccfd76a7d1956aeb8761d73e88b` | 0 |
| [decisions/owner-decisions-2026-09-24.md](../decisions/owner-decisions-2026-09-24.md) | `docs/rewrite-v3/prep/owner-decisions-2026-09-24.md` | `a2a383dc52159e53c43f3bbfd9b94f55c6b2bb49c8f2cb2ae1ec0a61c68dadb7` | 0 |
| [spec/00-first-cartridge-design.md](00-first-cartridge-design.md) | `docs/rewrite-v3/00-first-cartridge-design.md` | `809ba8073b05e1df9839a40800f06c2af712fb688e7148dc44762f5f98375ac9` | 0 |
| [spec/00a-chapter-one-content.md](00a-chapter-one-content.md) | `docs/rewrite-v3/00a-chapter-one-content.md` | `85aba34f031ec590cb5b68b4f12352a26183199bb38b8016285213a491748d42` | 0 |
| [spec/01-core-principles.md](01-core-principles.md) | `docs/rewrite-v3/01-core-principles.md` | `ad575cd2762a5e1eee41508179cff45360e7cbd891b68e5d1cb440c99e85956c` | 0 |
| [spec/02-beam-runtime-architecture.md](02-beam-runtime-architecture.md) | `docs/rewrite-v3/02-beam-runtime-architecture.md` | `3760601eda7f455e43fd9462b71fa7bdf4c215d5686cc538ad2e449a0bef6def` | 0 |
| [spec/03-domain-state-persistence.md](03-domain-state-persistence.md) | `docs/rewrite-v3/03-domain-state-persistence.md` | `e2b96029d3d003782dd0e494b1a20e362f834b32f21fca7361c5e6176586a733` | 0 |
| [spec/04-command-event-effect-protocol.md](04-command-event-effect-protocol.md) | `docs/rewrite-v3/04-command-event-effect-protocol.md` | `1243eb240c2fd5028b5d26ca19b1b1d822d30609dbd51bb95f06152c68b63444` | 0 |
| [spec/05-cartridges-content-capabilities.md](05-cartridges-content-capabilities.md) | `docs/rewrite-v3/05-cartridges-content-capabilities.md` | `46aeaa72056f5a7dc547a1fa1d9477dcbf30979ce1b666ddd0f1ae497c83a78d` | 0 |
| [spec/06-quests-dialogue-actions-scripting.md](06-quests-dialogue-actions-scripting.md) | `docs/rewrite-v3/06-quests-dialogue-actions-scripting.md` | `0edae241b8a4f5091590606a87fd006e6ec4a4ef4482b99d311c05579fa6e90b` | 0 |
| [spec/07-offline-storypacks-to-mmo.md](07-offline-storypacks-to-mmo.md) | `docs/rewrite-v3/07-offline-storypacks-to-mmo.md` | `3d0a516164ade2f1534877891715d49e3cdf62089e8e72f4f118d9918008664b` | 0 |
| [spec/08-builder-api-ai-factory.md](08-builder-api-ai-factory.md) | `docs/rewrite-v3/08-builder-api-ai-factory.md` | `72de02a4d48a85b7af595c30131aae1211fe25f7030d2f58b46c20efde006004` | 0 |
| [spec/09-cartridge-lab-certification.md](09-cartridge-lab-certification.md) | `docs/rewrite-v3/09-cartridge-lab-certification.md` | `06370f7bfbcef8e13ab140a71ff4d611a1cf2d67b43445736b144a524d8540b5` | 0 |
| [spec/10-mobile-commerce-release.md](10-mobile-commerce-release.md) | `docs/rewrite-v3/10-mobile-commerce-release.md` | `e78bf9dfbf19719081bb84c00e42d810ae4718ff3cb27028cb5f50cc0f701e4b` | 0 |
| [spec/11-security-observability-operations.md](11-security-observability-operations.md) | `docs/rewrite-v3/11-security-observability-operations.md` | `140d7a93110f84f295b9f3697b9188635551f75f210ef2484bdc2a734ff22831` | 0 |
| [spec/14-implementation-plan.md](14-implementation-plan.md) | `docs/rewrite-v3/14-implementation-plan.md` | `0578fd7404b59a3c37819ebd4edc5fae75fda413431076d03e1b75b234c865e4` | 1 |
| [spec/15-acceptance-scenarios.md](15-acceptance-scenarios.md) | `docs/rewrite-v3/15-acceptance-scenarios.md` | `104e66dcebb6639394386e3487af61b382ee563501d6876b74ea8540aeef2436` | 0 |
| [spec/16-decision-register.md](16-decision-register.md) | `docs/rewrite-v3/16-decision-register.md` | `e949d65e3e5ce8d9a17b7b2734451e3f0ef3d4d8c8a8c8ab13f3db91965c460d` | 0 |
| [spec/19-quest-sharing-instancing-capacity.md](19-quest-sharing-instancing-capacity.md) | `docs/rewrite-v3/19-quest-sharing-instancing-capacity.md` | `f6e597fd7ebc1d3410e43cba3b9df1a8d870a42f73b1794ad8d029b105ed5bb5` | 0 |
| [spec/21-composable-world-primitives.md](21-composable-world-primitives.md) | `docs/rewrite-v3/21-composable-world-primitives.md` | `959d2b9ba411cb2c03fb6a4c022a1e17ea611471d65c2a3f59582795b1a63164` | 0 |
| [spec/23-accounts-progress-admission.md](23-accounts-progress-admission.md) | `docs/rewrite-v3/23-accounts-progress-admission.md` | `a09f4aa32d070718c6718c3cb1680224e3ad120b87c791e16dff0fef1e468a1b` | 0 |
| [spec/INDEX.md](INDEX.md) | `docs/rewrite-v3/INDEX.md` | `369c98f77d3e1b383e44ae1e7d3d743298aef6edc8ac8a313beda0f4d75e98b8` | 1 |
| [spec/R-MILESTONES.md](R-MILESTONES.md) | `docs/rewrite-v3/R-MILESTONES.md` | `62f6f8097768ba7c45bc12934aa3987f4bb5bcec92d3a636c08890f21db8112c` | 2 |
| [spec/README.md](README.md) | `docs/rewrite-v3/README.md` | `3e89bb5c87edfaaa7434127dbf6dafa83e15d537fdd4d516415b33c1071e9ce1` | 12 |
| [spec/REVIEW-GUIDE.md](REVIEW-GUIDE.md) | `docs/rewrite-v3/REVIEW-GUIDE.md` | `2bde70363bca57e150b9419eb443a4642a7cdf19a690d7467a1ba3706fdb42bc` | 12 |
| [spec/conformance/README.md](conformance/README.md) | `docs/rewrite-v3/conformance/README.md` | `bab701a261173bfd0f116e1bffa9e47863a64959e5b8c78053f72ff38304ca42` | 2 |
| [spec/conformance/adverse-cases.json](conformance/adverse-cases.json) | `docs/rewrite-v3/conformance/adverse-cases.json` | `1b699cf2ce71181a2b09a596ed2253c06caa435aad4b5eb8a8ea9601fbadf5b1` | 0 |
| [spec/conformance/cases.json](conformance/cases.json) | `docs/rewrite-v3/conformance/cases.json` | `fa4969066ed86de5c26c10d23c069d7928f90e8b5064ff751597d30c0c787bcb` | 0 |
| [spec/conformance/composition-cases.json](conformance/composition-cases.json) | `docs/rewrite-v3/conformance/composition-cases.json` | `26a9fe8f84125477a0c4e340f19355eaf0c3422c2b1c215b370f5dcd435f22ee` | 0 |
| [spec/conformance/composition-profile.json](conformance/composition-profile.json) | `docs/rewrite-v3/conformance/composition-profile.json` | `f812bf42c97c8b9731da8783dce1ade1e6f6c9fea9b6eab5beb297d4bab5dcdd` | 0 |
| [spec/conformance/contract-links.json](conformance/contract-links.json) | `docs/rewrite-v3/conformance/contract-links.json` | `e3b653e583a0a784d4a978a324ba8c2406a98f71c0d4adb46946d1077cd8078c` | 0 |
| [spec/conformance/lantern-traces.json](conformance/lantern-traces.json) | `docs/rewrite-v3/conformance/lantern-traces.json` | `e5aaf947a7978520752f2aeee9665d171a917b97311952b3c347167faf392a89` | 0 |
| [spec/conformance/numeric-profile.md](conformance/numeric-profile.md) | `docs/rewrite-v3/conformance/numeric-profile.md` | `2fad2bfcb6fe0840b58e9fdcce049b4d441a1be4b9d9d2e82e0879a24c69aa1f` | 0 |
| [spec/conformance/numeric-vectors.json](conformance/numeric-vectors.json) | `docs/rewrite-v3/conformance/numeric-vectors.json` | `85472ae4e7626ca7326b881766e21ae23dd253c82b5c9d4c8d0c86f89ee168c9` | 0 |
| [spec/conformance/r1-run-manifest.template.json](conformance/r1-run-manifest.template.json) | `docs/rewrite-v3/conformance/r1-run-manifest.template.json` | `ed703ec67a0a0d4575550a9e628cce7d851b8b4d3fb1bdca18c5798a03a0c4a4` | 0 |
| [spec/pre-release-proof.md](pre-release-proof.md) | `docs/rewrite-v3/pre-release-proof.md` | `b41d8689ae4207d56e494354a5ceca2beb9835bfb74d9e973dd021434ecd9e4a` | 0 |
| [spec/r1-acceptance-envelope.md](r1-acceptance-envelope.md) | `docs/rewrite-v3/r1-acceptance-envelope.md` | `11a81f8e4ce4d9c8d4614e08a99469c4f28d086452c87015066516a2889dd5f6` | 1 |
| [spec/release-scope.json](release-scope.json) | `docs/rewrite-v3/release-scope.json` | `3e44ad12522f06d5af470ea1c77651df37c11a2bee6f2808c04534ce1accdbd9` | 0 |
| [spec/release-scope.md](release-scope.md) | `docs/rewrite-v3/release-scope.md` | `25a49818a6fde1d21a5953d9d6d4e0a7903cac14259cce57c4c05280111ba51d` | 0 |
