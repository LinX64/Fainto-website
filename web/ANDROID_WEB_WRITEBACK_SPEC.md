# Web → Phone transaction write-back over the pairing DataChannel

**Status:** Design / implementation spec. **No Android code is changed by this document.**
**Target repo:** the Fainto Android app at `/Users/mohsen/StudioProjects/Fainto/` (package `com.fainto.*`).
**Audience:** whoever implements the Android side. The browser side is out of scope here (one note at the end).

---

## 1. Problem

A paired **no-account** user (Wi-Fi / QR pairing, no Firebase sign-in) can pull their data *from* the
phone into the browser, but cannot push anything *back*. The RTCDataChannel is **send-only today**:

- `feature/settings/src/main/kotlin/com/fainto/feature/settings/webconnect/WebRtcSessionManagerImpl.kt`
  is an **answerer-only** peer (`createDataChannel` is never called; it only accepts the browser-created
  channel via `onDataChannel`, asserting the label `faintoBundle` — line 40, `EXPECTED_DATA_CHANNEL_LABEL`).
- The phone frames a full-data-export bundle and **sends** it (`sendBundle`, lines 202–225, using
  `WebRtcBundleFraming.buildFrames`).
- The inbound direction is a **no-op**: the `DataChannel.Observer` returned by `buildDataChannelObserver`
  (lines 188–200) has

  ```kotlin
  override fun onMessage(buffer: DataChannel.Buffer?) = Unit   // line 193
  ```

We want the *same* channel to also accept a batch of **new transactions** typed in the browser and insert
them on the phone, for no-account pairing sessions.

**Non-goals:** editing/deleting existing transactions from the web; syncing anything other than
transactions; changing the QR/signaling/offer-answer handshake; any browser code.

---

## 2. Why Firestore is used today instead (and why it doesn't cover this case)

Signed-in users already get **bidirectional** transaction sync for free through Firestore, so no
DataChannel write-back was ever needed for them:

- `app/src/main/kotlin/com/fainto/app/sync/DataSyncCoordinator.kt` keeps every registered
  `SyncableStore` reconciled with its cloud counterpart for the whole app lifetime. Transactions are an
  **entity-collection store**: a debounced (~8 s) **push** diff on local change, plus a Firestore
  **snapshot-listener pull** merged into local via **last-writer-wins per entity id**
  (`core/data/src/main/kotlin/com/fainto/core/data/sync/FirestoreEntityCollectionSyncRepository.kt`,
  `EntityIndex.kt`). A transaction entered on the web dashboard while signed in simply writes to
  Firestore and the phone's listener applies it.

The **no-account** pairing path has no Firestore mirror of the user's data — the WebRTC DataChannel *is*
the entire transport. That is the gap this spec fills. The design deliberately reuses the LWW/idempotent
mindset from the Firestore path (de-dupe by transaction `id`) so re-sends are safe.

---

## 3. What already exists and is reused verbatim

### 3.1 Framing — reused *in reverse*

`feature/settings/.../webconnect/WebRtcBundleFraming.kt` already defines both halves of the wire format:

- **Builder (phone → browser today):** `object WebRtcBundleFraming` — `buildFrames(payloadJson): List<String>`,
  `CHUNK_SIZE_BYTES = 16384`. Emits one `{type:"meta",totalChunks,totalBytes,sha256}` frame, N
  `{type:"chunk",index,data(base64)}` frames, one `{type:"end"}` frame.
- **Reassembler (already written, currently unused on device):** `class WebRtcFrameReassembler` with
  `fun feed(frameJson: String): WebRtcAssemblyOutcome?`. It buffers `meta` + `chunk` frames, and on the
  `end` frame `finalize()` **already verifies `totalChunks`, `totalBytes` and the `sha256`** before
  returning `WebRtcAssemblyOutcome.Success(payloadJson)`. Failures come back as
  `WebRtcAssemblyOutcome.Failure(WebRtcAssemblyFailure.{MALFORMED_FRAME | INCOMPLETE_CHUNKS | CHECKSUM_MISMATCH})`.

  This class is import-free of Android/WebRTC and unit-testable on plain JVM. **The inbound handler is
  essentially: pipe every received text frame into a `WebRtcFrameReassembler` and act on the `Success`.**
  The browser must send the *identical* framing the phone sends — the same `meta`/`chunk`/`end` shapes.

### 3.2 Data model (target of the write)

`core/data/src/main/kotlin/com/fainto/core/data/model/`:

- `Transaction.kt` — `@Serializable data class Transaction(id: String, amount: Double, type: TransactionType,
  category: TransactionCategory, note: String = "", timestampMillis: Long, … importSource: ImportSource? = null)`.
  (Other fields — `iconKey`, `foreignAmount`, `tags`, `externalId`, etc. — all have defaults and are left null/empty here.)
- `TransactionType.kt` — `enum { INCOME, EXPENSE }`.
- `TransactionCategory.kt` — **exactly 11** values: `FOOD, HOUSING, TRANSPORT, UTILITIES, ENTERTAINMENT,
  HEALTH, SHOPPING, SAVINGS, SALARY, EDUCATION, OTHER`.
- `ImportSource.kt` — `enum { MANUAL, CSV, OFX }`. Use **`CSV`** for a browser CSV upload, **`MANUAL`** for
  a hand-typed entry.

All four are `kotlinx.serialization` `@Serializable`, so the browser payload can be decoded straight into
`List<Transaction>` (or into a thin inbound DTO — see §4) with `Json`.

### 3.3 Persistence (how the write lands)

`core/data/src/main/kotlin/com/fainto/core/data/repository/`:

- `TransactionRepository.kt` (interface): `suspend fun add(tx: Transaction)`,
  `suspend fun addBatch(list: List<Transaction>)`, `suspend fun getById(id: String): Transaction?`,
  `val transactions: Flow<List<Transaction>>`.
- `TransactionRepositoryImpl.kt` — encrypted-at-rest, `@Singleton`. `addBatch` appends in a **single
  persist call** and **aborts (does not overwrite) when stored data is currently unreadable** — the
  resilience contract. This is the same call `ImportTransactionsUseCase` uses.

Existing add-transaction use cases for reference:

- `core/domain/.../usecase/AddTransactionUseCase.kt` — **not suitable as-is**: it *generates its own
  `UUID`* and does **not** accept `id` or `importSource` (always effectively `MANUAL`). It cannot honor a
  browser-supplied id (needed for idempotent de-dupe) nor tag the source.
- `core/domain/.../usecase/ImportTransactionsUseCase.kt` — **the right shape to mirror**: maps rows →
  `Transaction(importSource = …)` and writes with a single `repository.addBatch(...)`, returning the count
  written. It de-dupes on a caller flag, not on `id`; our version de-dupes on `id`.

**Recommendation:** add a dedicated `ApplyWebInboundTransactionsUseCase` (below) rather than bending
`AddTransactionUseCase`.

---

## 4. Inbound message envelope (browser → phone)

Reuse the existing framing (§3.1) for transport; define **one** small application envelope for the
reassembled payload. Keep it explicitly versioned and typed so the phone can reject anything it doesn't
understand.

Proposed new file:
`feature/settings/src/main/kotlin/com/fainto/feature/settings/webconnect/WebInboundMessage.kt`

```kotlin
package com.fainto.feature.settings.webconnect

import com.fainto.core.data.model.TransactionCategory
import com.fainto.core.data.model.TransactionType
import com.fainto.core.data.model.ImportSource
import kotlinx.serialization.Serializable

/** Application-level envelope carried inside the reassembled DataChannel payload (browser → phone). */
@Serializable
data class WebInboundMessage(
    val schemaVersion: Int = 1,
    val kind: String,                        // "addTransactions" — reject anything else
    val transactions: List<WebInboundTransaction> = emptyList(),
)

/**
 * A single transaction typed in the browser. Deliberately a *narrow* DTO — NOT the full [Transaction] —
 * so the browser can only set the fields it is allowed to set. Everything else is defaulted on device.
 */
@Serializable
data class WebInboundTransaction(
    val id: String,                          // UUID string; the de-dupe key (idempotent re-send)
    val amount: Double,                      // must be finite and > 0
    val type: TransactionType,               // INCOME | EXPENSE
    val category: TransactionCategory,       // one of the 11 enum values
    val timestampMillis: Long,               // must be > 0
    val note: String = "",
    val importSource: ImportSource = ImportSource.MANUAL,   // MANUAL (typed) or CSV (uploaded)
)
```

**Why a DTO and not `List<Transaction>` directly:** it keeps the write surface minimal (the browser can't
inject `receiptUri`, `transferPeerId`, `externalId`, `splitOf`, etc.), and it makes validation the phone's
job. Because both the DTO and `Transaction` are `@Serializable`, decoding is
`Json { ignoreUnknownKeys = true }.decodeFromString(WebInboundMessage.serializer(), payloadJson)`.

### 4.1 Validation rules applied on device (reject the whole batch on any violation)

- `schemaVersion == 1` and `kind == "addTransactions"`.
- Each `amount` is finite and strictly `> 0` (the `Transaction` contract is a positive amount; sign is
  carried by `type`, matching `ImportTransactionsUseCase`).
- `type` and `category` deserialize to known enum constants (kotlinx.serialization throws on unknown enum
  values → treat as a malformed batch).
- `timestampMillis > 0` (and optionally within a sane window, e.g. not absurdly future).
- `id` is a non-blank string; duplicate ids **within** the batch collapse to one.
- Batch size cap (e.g. reject `> 2000` rows) as a DoS guard; `CHUNK_SIZE_BYTES` framing already bounds
  per-frame size.

### 4.2 Mapping + idempotent insert

New file: `core/domain/src/main/kotlin/com/fainto/core/domain/usecase/ApplyWebInboundTransactionsUseCase.kt`

```kotlin
class ApplyWebInboundTransactionsUseCase @Inject constructor(
    private val repository: TransactionRepository,
) {
    /** @return number of NEW transactions actually written (0 if all were duplicates / batch empty). */
    suspend operator fun invoke(incoming: List<WebInboundTransaction>): Int {
        if (incoming.isEmpty()) return 0
        val existingIds = repository.transactions.first().mapTo(HashSet()) { it.id }
        val fresh = incoming
            .distinctBy { it.id }
            .filter { it.id !in existingIds }               // de-dupe by id → idempotent re-send
            .map { row ->
                Transaction(
                    id = row.id,                            // keep the browser id (the de-dupe key)
                    amount = row.amount,
                    type = row.type,
                    category = row.category,
                    note = row.note,
                    timestampMillis = row.timestampMillis,
                    importSource = row.importSource,        // CSV or MANUAL
                )
            }
        if (fresh.isEmpty()) return 0
        repository.addBatch(fresh)                          // single persist call; aborts if unreadable
        return fresh.size
    }
}
```

Notes:
- `WebInboundTransaction` lives in the `feature/settings/webconnect` package; the use case is in `core/domain`.
  Either move the DTO to a shared module the domain layer can see, or have the transport layer do the
  DTO→`Transaction` map and pass `List<Transaction>` into the use case. Prefer the latter to avoid a
  feature→domain type dependency: the use case takes `List<Transaction>` and de-dupes by `id`; the
  transport layer owns `WebInboundMessage`/validation.
- De-dupe uses `repository.transactions.first()` (a snapshot of current ids). `addBatch` only appends, so
  the caller **must** filter existing ids — the repo does not do it.

---

## 5. Transport change — implementing `onMessage`

All work is inside `WebRtcSessionManagerImpl.kt`. Keep every WebRTC/DataChannel touch on the existing
single-thread `@WebRtcDispatcher` (`managerScope = CoroutineScope(SupervisorJob() + webRtcDispatcher)`,
line 63) — the native peer-connection is not thread-safe (see the class KDoc, lines 49–55).

### 5.1 Wire the reassembler into the channel observer

Replace the no-op `onMessage` (line 193) inside `buildDataChannelObserver` (lines 188–200). Give the
manager a per-session `WebRtcFrameReassembler` (nullable field, created when the channel opens, cleared in
`closeInternal`, lines 263–273):

```kotlin
private var inboundReassembler: WebRtcFrameReassembler? = null

private fun buildDataChannelObserver(
    channel: DataChannel,
    buildPayload: suspend () -> String,
): DataChannel.Observer = object : DataChannel.Observer {
    override fun onBufferedAmountChange(previousAmount: Long) = Unit

    override fun onMessage(buffer: DataChannel.Buffer?) {
        if (buffer == null || buffer.binary) return          // we speak UTF-8 text frames only
        val frameJson = buffer.data.decodeToUtf8()           // copy the ByteBuffer to a String
        // Hop onto the WebRTC dispatcher; onMessage is delivered on a native thread.
        managerScope.launch { handleInboundFrame(frameJson) }
    }

    override fun onStateChange() {
        if (channel.state() == DataChannel.State.OPEN) {
            managerScope.launch { sendBundle(channel, buildPayload) }
        }
    }
}
```

> ⚠️ **Copy the buffer immediately.** `DataChannel.Buffer.data` is a native `ByteBuffer` reused after
> `onMessage` returns — decode/copy it to a `String` *inside* `onMessage`, before the `launch`, then hand
> the immutable `String` to the coroutine. Do not read the `ByteBuffer` from inside the coroutine.

`decodeToUtf8()` is a small local extension over `ByteBuffer` (mirror of the outgoing `sendText`
extension, line 338).

### 5.2 Feed frames and apply on success

```kotlin
private suspend fun handleInboundFrame(frameJson: String) {
    val reassembler = inboundReassembler ?: WebRtcFrameReassembler().also { inboundReassembler = it }
    when (val outcome = reassembler.feed(frameJson)) {
        null -> Unit                                         // meta/chunk buffered, nothing to do yet
        is WebRtcAssemblyOutcome.Failure -> {
            inboundReassembler = null                        // reset for the next batch
            _state.value = WebConnectState.Error(WebConnectError.CONNECTION_FAILED)  // or a new INBOUND_* error
        }
        is WebRtcAssemblyOutcome.Success -> {
            inboundReassembler = null
            applyInboundPayload(outcome.payloadJson)         // decode envelope, validate, insert
        }
    }
}
```

`applyInboundPayload` decodes `WebInboundMessage`, runs §4.1 validation, maps to `List<Transaction>`, and
calls `ApplyWebInboundTransactionsUseCase` (inject it into the manager, or route through a thin callback
the way `buildPayload` is passed in, to keep the manager free of domain deps). On a successful insert,
optionally send a small **ack frame** back to the browser (reusing `WebRtcBundleFraming.buildFrames` with a
`{kind:"ack",applied:N}` payload) so the web UI can confirm; this is optional and can be a follow-up.

### 5.3 Lifecycle / cleanup

- Null out `inboundReassembler` in `closeInternal` (lines 263–273) alongside `dataChannel`/`peerConnection`.
- The phone currently tears the session down after `sendBundle` completes (`awaitDelivery` → `Completed` →
  `closeInternal`, lines 233–240, 216–219). **Write-back needs the channel to stay open after the initial
  export send.** Decide the interaction: either (a) keep the session open after the export completes so the
  browser can push (change `awaitDelivery`/`Completed` handling), or (b) treat write-back as its own
  session direction. Simplest: keep the channel open — don't `closeInternal` on `Completed`; close on
  explicit `disconnect()` / screen exit (`WebConnectViewModel.onCleared`) / timeout. **This is the main
  lifecycle change and must be called out in the implementation PR.**

### 5.4 New state (optional but recommended)

Extend `WebConnectState` (`WebRtcSessionManager.kt`) and `WebConnectUiState`
(`webconnect/model/WebConnectUiState.kt`) so the screen can show inbound progress and a result, e.g.
`WebConnectState.Receiving(applied: Int)` / a new `WebConnectError.INBOUND_REJECTED`. Map them in
`WebConnectViewModel.toUiState()` (lines 96–111). Not strictly required for correctness — the write can be
silent — but the pairing screen currently only models the outbound `Sending` states.

---

## 6. Security & trust model

The inbound write is the sensitive part. Rules:

1. **Only accept inbound writes while a user-initiated pairing session is open.** The session only exists
   because the **user scanned the QR on the phone** (`WebConnectViewModel.onQrCodeScanned` →
   `parseWebConnectQr` → `connect`) — i.e. the on-device pairing is already the trust root. Concretely:
   process `onMessage` **only** when `_state.value` is a connected state and `dataChannel != null` and the
   channel is `OPEN`. If no session is active, drop the frame.
2. **Never auto-apply outside an active, trusted pairing.** There is no background/persistent inbound
   listener — the `WebRtcSessionManager` is built lazily (`dagger.Lazy` in `WebConnectViewModel` /
   `WebConnectModule`) and only exists while the "Connect to Web" screen is on-screen. Do not add any code
   path that accepts inbound transactions without the on-device pairing screen being active.
3. **Per-session confirm (recommended).** Before persisting the first inbound batch of a session, surface a
   one-tap on-device confirmation ("Allow this browser to add N transactions?") gated on the user. This
   keeps the DataChannel from silently mutating the on-device store even within a live session — the phone
   holder stays the final authority. Once confirmed, subsequent batches in the *same* session may apply
   without re-prompting (or re-prompt per batch — product call).
4. **Validate before persist (§4.1).** Reject the whole batch on any malformed field; never partially apply
   a corrupt batch. The `sha256` in the framing already guarantees integrity end-to-end (verified in
   `WebRtcFrameReassembler.finalize`); §4.1 guarantees *semantic* validity.
5. **Idempotent by `id` (§4.2).** A re-sent batch (e.g. the browser retries after a dropped ack) must not
   duplicate rows. De-dupe against existing `Transaction.id`s.
6. **Bounded.** Cap batch size and rely on the existing per-frame `CHUNK_SIZE_BYTES` / `MAX_BUFFERED_BYTES`
   (lines 37, 44) limits. The DataChannel is P2P (STUN only, no TURN relay), same as the export direction.
7. **No new capability for signed-in users needed** — they already have Firestore LWW sync (§2); this path
   is specifically for the no-account transport.

---

## 7. Corresponding WEB change (out of scope — note only)

The browser currently only *receives*: in `/Users/mohsen/StudioProjects/Fainto-website/web/app.html` the
data channel `pc.createDataChannel('faintoBundle', { ordered: true })` sets `channel.onmessage =` to parse
the incoming export, and there is **no `channel.send(...)`** path. To push transactions the browser must:

- build the **same** framing the phone expects — one `{type:"meta",totalChunks,totalBytes,sha256}` frame
  (sha256 of the UTF-8 payload bytes, lowercase hex), N `{type:"chunk",index,data:base64}` frames of
  ≤ `CHUNK_SIZE_BYTES` (16384) raw bytes each, one `{type:"end"}` frame — and `channel.send(frameJson)`
  each in order while respecting `bufferedAmount` backpressure;
- serialize the `WebInboundMessage` envelope (§4) as the payload;
- optionally wait for the phone's ack frame (§5.2) before clearing its local draft.

**This document does not change any browser code.** Implement the Android side first (it is a strict superset
— an unrecognized inbound frame is simply dropped), then wire the browser sender in a separate change.

---

## 8. Implementation checklist (Android only)

- [ ] Add `WebInboundMessage` / `WebInboundTransaction` DTO (`feature/settings/webconnect/`).
- [ ] Add `ApplyWebInboundTransactionsUseCase` (`core/domain/usecase/`) — de-dupe by `id`, `addBatch`.
- [ ] `WebRtcSessionManagerImpl`: per-session `WebRtcFrameReassembler`; implement `onMessage` (copy buffer,
      hop to `@WebRtcDispatcher`, `feed`, apply on `Success`); reset on `Failure`/close.
- [ ] Keep the channel open after the export `sendBundle` completes (lifecycle change, §5.3).
- [ ] Gate inbound on an active, user-initiated, `OPEN`-channel session; add the per-session confirm (§6).
- [ ] Envelope validation (§4.1); optional ack frame; optional new `WebConnectState`/`WebConnectError`.
- [ ] Tests: `WebRtcFrameReassembler` round-trip against browser-shaped frames (plain JVM), envelope
      validation rejects bad enums/amounts, `ApplyWebInboundTransactionsUseCase` idempotency (re-send same
      `id` → 0 written), `TransactionRepository.addBatch` "unreadable → abort" contract preserved.

---

## 9. File reference index

| Concern | Path |
|---|---|
| Answerer / channel / `onMessage` no-op (lines 188–200, 193) | `feature/settings/src/main/kotlin/com/fainto/feature/settings/webconnect/WebRtcSessionManagerImpl.kt` |
| Framing + `WebRtcFrameReassembler` (reused in reverse) | `feature/settings/.../webconnect/WebRtcBundleFraming.kt` |
| Transport state / errors | `feature/settings/.../webconnect/WebRtcSessionManager.kt` |
| Session lifecycle / QR parse | `feature/settings/.../webconnect/WebConnectViewModel.kt` |
| Screen state | `feature/settings/.../webconnect/model/WebConnectUiState.kt` |
| DI (`@WebRtcDispatcher`, lazy binding) | `feature/settings/.../webconnect/di/WebConnectModule.kt` |
| `Transaction` / `TransactionType` / `TransactionCategory` (11) / `ImportSource` | `core/data/src/main/kotlin/com/fainto/core/data/model/` |
| Repository (`add` / `addBatch` / `getById`) | `core/data/.../repository/TransactionRepository.kt`, `TransactionRepositoryImpl.kt` |
| Add / import use cases to mirror | `core/domain/.../usecase/AddTransactionUseCase.kt`, `ImportTransactionsUseCase.kt` |
| Firestore bidirectional sync (why not needed for signed-in) | `app/src/main/kotlin/com/fainto/app/sync/DataSyncCoordinator.kt`, `core/data/.../sync/FirestoreEntityCollectionSyncRepository.kt` |
| Browser sender (out of scope, note only) | `/Users/mohsen/StudioProjects/Fainto-website/web/app.html` (`createDataChannel('faintoBundle')`) |
