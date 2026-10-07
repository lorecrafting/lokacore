# E1 Wisp ward and infirmary herb author checkpoint

Separate `proof/e1-wisp-herbs-paths` branch from `e64a6ba4`; author source `2d08b5faf3925a8e0e201b8d237c9f5ad506cc84`. The [recipes](../../../kernel/ts/test/e1_wisp_herbs.ts) and [focused tests](../../../kernel/ts/test/e1_wisp_herbs.test.ts) consume only the frozen v042 candidate through the existing real SQLite authority. Neither case is registered, and E1 certification remains pending. These routes require no local C6 checker workaround.

## Literal route results

[Wisp S4](../../system/mechanics.md#s4-all-hours-wisp-b6-selected-contract) / [B6 parameters](../../system/cartridge.md#b6-marsh-route-and-tuning): fresh road-born travels to Marsh Light and Seeks at the authored perception threshold. Discovery is true while answer/ward are false. Explicit acceptance creates one occurrence. Bank-valid `EDIT`, `DIET`, `TIED` answers commit counts one/two and then close only that sitting at the third, with the same active quest and no answer/ward. Cold reopens preserve each boundary. A new sitting has a different continuation and literal zero-of-three count. `TIDE` resolves the original occurrence as `answer`, sets both answer and ward true and leaves RNG `[1,2,3,4]`. Legal public travel reaches original Aldric; the exact `c_aldric_ward` selector and subsequent ward choice consume the knowledge after reopening. Retained trace: 25 commands, 11 reopens.

[Herb S9](../../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract) / [B5 stock](../../system/cartridge.md#b5-herb-and-bandage-stock): fresh road-born legally harvests all twelve declared fenwort originals; the thirteenth Harvest refuses `not_found`. No paid herbalism lesson or careful-harvest method is used. Public travel reaches Wick. Four explicit acceptance/turn-in pairs produce distinct occurrences while keeping only one current quest row. Reopens occur before each later acceptance/exchange consumer. Literal contribution/axis answers are 1/2/3/3; held bandages are 3/6/9/12 and remaining herbs 9/6/3/0. Wick receives those original herbs and transfers all twelve declared original bandages. The fourth funded exchange still delivers three bandages at the contribution cap. Retained trace: 43 commands, 17 reopens.

## Checks and controls

- `green.log`: existing case checks plus both new route checks pass (four tests, exit 0). Each new route repeats from a fresh database and compares its deterministic digest; its commands are independently replayed through `AUTHORITY_KERNEL`. TypeScript typecheck and formatting also pass.
- `wisp-answer-*`: omitting the correct `TIDE` choice leaves the old case suite green (exit 0), but fails the new Wisp check (exit 1).
- `fourth-exchange-*`: omitting only the fourth exchange likewise passes the old suite and fails the new herb check (exit 1). Both mutations are restored.
- `retained-replay.log`: reads the retained ordered JSONL commands, reconstructs the admitted fresh world using retained identity/RNG, checks the initial-state hash and replays the invariants; both traces pass (exit 0).

Actual source/check/policy, content/artifact, recipe and test digests are bound in each retained start record. The existing recorder digest is separate because these proof recipes are unregistered. `certification: false` is explicit. Capture redaction covers local paths; generated world/entity IDs are deterministic proof inputs. Hashes protect unchanged raw bytes. No owner save, native/browser lifecycle, Wait, hidden state write, adjusted start, altered candidate or paid service is used. Tests use private placeholder kernel revisions; retained traces use the actual author source.

## Pending

These cases do not discharge authored inventory paths or establish broad gate coverage. Failed-threshold Seek, light and malformed-answer refusals, stale exchange custody/carrying boundaries, uncertain COMMIT/fault/retry schedules and all other routes remain outside this checkpoint. The current reviewed recorder and watch-review source remain untouched. Published-main integration, independent review, registration and final source-bound certification remain separate work; no final 10,000 run or additional full gate was started. This documentation commit follows the retained author source and issues no final certificate.
