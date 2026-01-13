# Encrypted Peer-to-Peer Communication System

## Executive Summary

This proposal implements **fully encrypted, peer-to-peer communication** within Loka using:

1. **MLS (Message Layer Security)** via Wire Core Crypto for end-to-end encryption
2. **WebRTC Data Channels** for direct P2P connections
3. **Phoenix WebSocket** as encrypted relay fallback

**Key outcomes:**
- All player-to-player messages (tells, group chat, guild chat) are end-to-end encrypted
- The server **never stores or can read** message content
- Messages travel directly between clients when possible (P2P mesh)
- Works across web browsers and mobile clients
- Secure in-game communication that the server operator cannot access, surveil, or be compelled to produce

---

## Motivation

### Why Zero-Knowledge Communication?

1. **Privacy as a Feature**: Players can communicate without server-side logging
2. **Legal Protection**: Server can't produce what it doesn't have (subpoenas, GDPR requests)
3. **Trust**: Players know their guild strategies, personal conversations are truly private
4. **Reduced Liability**: No message storage = no moderation obligation for private channels
5. **Thematic Fit**: A monastery-themed game about inner peace shouldn't be surveilling conversations

### Scope

| Channel Type | Encrypted? | P2P? | Notes |
|--------------|------------|------|-------|
| Direct tells | Yes | Yes | 1:1 messages |
| Party/group chat | Yes | Yes (mesh) | Small groups (2-8 players) |
| Guild chat | Yes | Hybrid | Larger groups, may need relay |
| Local room say | No | No | Public, server-mediated |
| OOC/global | No | No | Public channels |
| Mail/messages | Yes | No | Async, encrypted at rest |

---

## Why MLS Over Signal Protocol

We chose **MLS (Message Layer Security, RFC 9420)** over Signal Protocol for several reasons:

| Factor | Signal Protocol | MLS |
|--------|-----------------|-----|
| **Group efficiency** | Pairwise keys, O(n) for member changes | Tree-based, O(log n) for member changes |
| **Designed for** | 1:1 chat, groups bolted on | Groups from the ground up |
| **Standardization** | Proprietary (open source) | IETF RFC 9420 (July 2023) |
| **Forward secrecy** | Per-message (Double Ratchet) | Per-epoch (TreeKEM) |
| **Post-compromise security** | Yes | Yes |
| **Industry adoption** | WhatsApp, Google Messages | Google Messages (planned), Apple RCS, Matrix |

**For guilds of 50+ members**, MLS's logarithmic complexity is significantly more efficient than Signal's linear approach.

---

## Chosen Technology Stack

### Encryption: Wire Core Crypto

**[@wireapp/core-crypto](https://www.npmjs.com/package/@wireapp/core-crypto)** - Production-ready MLS implementation

| Aspect | Details |
|--------|---------|
| **Implementation** | Rust (OpenMLS) compiled to WASM |
| **Protocol** | RFC 9420 compliant |
| **Production usage** | Wire messenger (millions of users) |
| **NPM package** | `@wireapp/core-crypto` v8.0.3+ |
| **Size** | ~500KB-1MB gzipped (WASM binary) |
| **Key storage** | Encrypted IndexedDB (web), Keychain/Keystore (mobile) |
| **Mobile support** | iOS (Swift FFI), Android (Kotlin FFI) |

**Why Wire Core Crypto:**
- Battle-tested in Wire's production app
- Handles all MLS complexity (ratchet tree, key scheduling, proposals/commits)
- TypeScript bindings included
- Cross-platform (same library for web + mobile when un-shelved)
- Actively maintained (9 contributors, regular releases)

### Transport: Hybrid P2P + Relay

```
┌─────────────────────────────────────────────────────────────┐
│ CONNECTION DECISION TREE                                   │
│                                                            │
│   1. Try WebRTC P2P connection                            │
│      ├── Success: Use data channel (best latency)         │
│      └── Fail: Continue to step 2                         │
│                                                            │
│   2. Try WebRTC via TURN relay                            │
│      ├── Success: Use TURN (still P2P-ish)                │
│      └── Fail: Continue to step 3                         │
│                                                            │
│   3. Fall back to encrypted WebSocket relay               │
│      └── Always works, server sees only encrypted blobs   │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LOKA CLIENT (LiveView + JavaScript)                        │
├─────────────────────────────────────────────────────────────┤
│ Loka Chat API                                              │
│   LokaCrypto.sendTell(playerId, message)                   │
│   LokaCrypto.sendGroupMessage(groupId, message)            │
│   LokaCrypto.onMessage(callback)                           │
├─────────────────────────────────────────────────────────────┤
│ MLS Layer (@wireapp/core-crypto)                           │
│   ├── CoreCrypto instance (WASM)                           │
│   ├── Group management (create, join, leave, update)       │
│   ├── Message encryption/decryption                        │
│   └── Encrypted IndexedDB keystore                         │
├─────────────────────────────────────────────────────────────┤
│ Transport Layer                                             │
│   ├── P2PManager (WebRTC data channels)                    │
│   │   ├── Direct connections when possible                 │
│   │   └── STUN/TURN for NAT traversal                      │
│   └── RelayManager (Phoenix WebSocket)                     │
│       └── Fallback, encrypted blobs only                   │
├─────────────────────────────────────────────────────────────┤
│ SERVER (Zero-Knowledge)                                     │
│   ├── WebRTC Signaling (SDP offers/answers, ICE)           │
│   ├── Key Package Registry (public keys only)              │
│   ├── Welcome Message Relay (encrypted, can't read)        │
│   ├── Encrypted Blob Relay (fallback transport)            │
│   └── Group Membership Metadata (who's in what group)      │
│                                                            │
│   Server CANNOT: Read message content, decrypt anything    │
└─────────────────────────────────────────────────────────────┘
```

---

## MLS Concepts

### Ratchet Tree

MLS uses a binary tree structure for efficient group key management:

```
                    [Root Key]
                   /          \
            [Node]              [Node]
           /      \            /      \
        [Alice]  [Bob]    [Carol]  [Dave]
```

- Each member is a leaf
- Internal nodes derive keys from children
- Adding/removing members updates O(log n) nodes
- Much more efficient than Signal's O(n) for groups

### Key Epochs

Groups progress through "epochs" - each membership change creates a new epoch with fresh keys:

```
Epoch 0: Alice creates group
Epoch 1: Alice adds Bob (new keys)
Epoch 2: Bob adds Carol (new keys)
Epoch 3: Alice removes Bob (new keys - Bob can't decrypt future messages)
```

### Welcome Messages

When adding a new member, MLS generates a "Welcome" message containing:
- Current group state (ratchet tree)
- Encryption keys for the current epoch
- Group metadata

This is encrypted to the new member's public key - server relays but can't read.

### Proposals and Commits

Group changes happen in two steps:
1. **Proposal**: Suggest a change (Add, Remove, Update)
2. **Commit**: Apply proposals, advance epoch

This allows batching multiple changes efficiently.

---

## Implementation Plan

### Phase 1: Foundation (1-2 weeks)

**Goal:** Encrypted 1:1 tells working end-to-end

#### 1.1 Add Wire Core Crypto to Client

```javascript
// assets/js/loka_crypto.js
import { CoreCrypto, Ciphersuite } from '@wireapp/core-crypto';

class LokaCrypto {
  constructor() {
    this.cc = null;
    this.clientId = null;
  }

  async initialize(playerId, playerSecret) {
    // Derive encryption key from player secret
    const dbKey = await this.deriveKey(playerSecret);

    this.clientId = this.toClientId(playerId);

    this.cc = await CoreCrypto.init({
      databaseName: `loka-mls-${playerId}`,
      key: dbKey,
      clientId: this.clientId,
      ciphersuites: [Ciphersuite.MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519]
    });

    // Generate initial key packages for others to use when adding us
    await this.cc.clientPublicKey();
  }

  async createKeyPackage() {
    // Key package others use to add us to groups
    const keyPackage = await this.cc.clientKeypackages(1);
    return keyPackage[0];
  }
}

export const lokaCrypto = new LokaCrypto();
```

#### 1.2 Server-Side Key Package Registry

```elixir
# lib/loka/crypto/key_package.ex
defmodule Loka.Crypto.KeyPackage do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "mls_key_packages" do
    belongs_to :player, Loka.Accounts.Player, type: :binary_id

    # Opaque to server - just bytes we relay
    field :key_package, :binary

    # For rotation/cleanup
    field :created_at, :utc_datetime
    field :consumed_at, :utc_datetime

    timestamps()
  end
end
```

```elixir
# lib/loka/crypto/key_packages.ex
defmodule Loka.Crypto.KeyPackages do
  alias Loka.Repo
  alias Loka.Crypto.KeyPackage

  @doc """
  Store a key package uploaded by client.
  Server cannot decrypt this - just stores bytes.
  """
  def upload_key_package(player_id, key_package_bytes) do
    %KeyPackage{}
    |> KeyPackage.changeset(%{
      player_id: player_id,
      key_package: key_package_bytes
    })
    |> Repo.insert()
  end

  @doc """
  Consume a key package when adding player to group.
  Returns the bytes to relay to the adder.
  """
  def consume_key_package(player_id) do
    # Get oldest unconsumed package
    case Repo.one(from kp in KeyPackage,
      where: kp.player_id == ^player_id and is_nil(kp.consumed_at),
      order_by: [asc: :created_at],
      limit: 1
    ) do
      nil -> {:error, :no_key_packages}
      kp ->
        kp
        |> KeyPackage.changeset(%{consumed_at: DateTime.utc_now()})
        |> Repo.update()

        {:ok, kp.key_package}
    end
  end
end
```

#### 1.3 Encrypted Tell Flow

```javascript
// Client A sends tell to Client B
class LokaCrypto {
  async sendTell(recipientId, message) {
    const conversationId = this.getConversationId(this.clientId, recipientId);

    // Check if conversation exists
    if (!await this.cc.conversationExists(conversationId)) {
      // Get recipient's key package from server
      const keyPackage = await this.fetchKeyPackage(recipientId);

      // Create MLS group with just us and recipient
      await this.cc.createConversation(conversationId, {
        // Config options
      });

      // Add recipient
      const welcome = await this.cc.addClientsToConversation(
        conversationId,
        [keyPackage]
      );

      // Send welcome message through server relay
      await this.sendWelcome(recipientId, welcome);
    }

    // Encrypt message
    const encrypted = await this.cc.encrypt(
      conversationId,
      new TextEncoder().encode(message)
    );

    // Send via P2P or relay
    await this.transport.send(recipientId, encrypted);
  }

  async onEncryptedMessage(senderId, encryptedBytes) {
    const conversationId = this.getConversationId(this.clientId, senderId);

    // Decrypt
    const decrypted = await this.cc.decrypt(conversationId, encryptedBytes);
    const message = new TextDecoder().decode(decrypted);

    // Emit to UI
    this.emit('message', { from: senderId, message });
  }
}
```

#### 1.4 Phoenix Channel for Relay

```elixir
# lib/loka_web/channels/crypto_channel.ex
defmodule LokaWeb.CryptoChannel do
  use LokaWeb, :channel

  def join("crypto:" <> player_id, _params, socket) do
    if socket.assigns.player_id == player_id do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Relay encrypted blob - server can't decrypt
  def handle_in("encrypted_message", %{"to" => recipient_id, "data" => data}, socket) do
    LokaWeb.Endpoint.broadcast("crypto:#{recipient_id}", "encrypted_message", %{
      from: socket.assigns.player_id,
      data: data
    })
    {:noreply, socket}
  end

  # Relay welcome message for new conversation
  def handle_in("welcome", %{"to" => recipient_id, "data" => data}, socket) do
    LokaWeb.Endpoint.broadcast("crypto:#{recipient_id}", "welcome", %{
      from: socket.assigns.player_id,
      data: data
    })
    {:noreply, socket}
  end

  # Upload key package
  def handle_in("upload_key_package", %{"data" => data}, socket) do
    Loka.Crypto.KeyPackages.upload_key_package(socket.assigns.player_id, data)
    {:reply, :ok, socket}
  end

  # Fetch key package for another player
  def handle_in("fetch_key_package", %{"player_id" => player_id}, socket) do
    case Loka.Crypto.KeyPackages.consume_key_package(player_id) do
      {:ok, key_package} -> {:reply, {:ok, %{data: key_package}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: reason}}, socket}
    end
  end
end
```

### Phase 2: P2P Transport (2-3 weeks)

**Goal:** Direct WebRTC connections when possible

#### 2.1 WebRTC Signaling Channel

```elixir
# lib/loka_web/channels/signaling_channel.ex
defmodule LokaWeb.SignalingChannel do
  use LokaWeb, :channel

  def join("signaling:" <> player_id, _params, socket) do
    if socket.assigns.player_id == player_id do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  # Relay SDP offer
  def handle_in("offer", %{"to" => peer_id, "sdp" => sdp}, socket) do
    LokaWeb.Endpoint.broadcast("signaling:#{peer_id}", "offer", %{
      from: socket.assigns.player_id,
      sdp: sdp
    })
    {:noreply, socket}
  end

  # Relay SDP answer
  def handle_in("answer", %{"to" => peer_id, "sdp" => sdp}, socket) do
    LokaWeb.Endpoint.broadcast("signaling:#{peer_id}", "answer", %{
      from: socket.assigns.player_id,
      sdp: sdp
    })
    {:noreply, socket}
  end

  # Relay ICE candidate
  def handle_in("ice", %{"to" => peer_id, "candidate" => candidate}, socket) do
    LokaWeb.Endpoint.broadcast("signaling:#{peer_id}", "ice", %{
      from: socket.assigns.player_id,
      candidate: candidate
    })
    {:noreply, socket}
  end
end
```

#### 2.2 P2P Manager

```javascript
// assets/js/p2p_manager.js
class P2PManager {
  constructor(lokaCrypto, signalingChannel) {
    this.crypto = lokaCrypto;
    this.signaling = signalingChannel;
    this.peers = new Map();      // peerId -> RTCPeerConnection
    this.channels = new Map();   // peerId -> RTCDataChannel

    this.setupSignalingHandlers();
  }

  setupSignalingHandlers() {
    this.signaling.on("offer", async ({ from, sdp }) => {
      await this.handleOffer(from, sdp);
    });

    this.signaling.on("answer", async ({ from, sdp }) => {
      await this.handleAnswer(from, sdp);
    });

    this.signaling.on("ice", async ({ from, candidate }) => {
      await this.handleIceCandidate(from, candidate);
    });
  }

  async connectToPeer(peerId) {
    if (this.channels.has(peerId)) {
      return this.channels.get(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN server for fallback
        {
          urls: 'turn:turn.loka.game:3478',
          username: this.getTurnUsername(),
          credential: this.getTurnCredential()
        }
      ]
    });

    this.peers.set(peerId, pc);

    // Create data channel
    const channel = pc.createDataChannel('loka-chat', {
      ordered: true,
      maxRetransmits: 3
    });

    channel.onopen = () => {
      console.log(`P2P channel open to ${peerId}`);
      this.channels.set(peerId, channel);
    };

    channel.onmessage = (event) => {
      // Message is already MLS-encrypted
      this.crypto.onEncryptedMessage(peerId, event.data);
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.push("ice", {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling.push("offer", { to: peerId, sdp: offer });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('P2P connection timeout'));
      }, 10000);

      channel.onopen = () => {
        clearTimeout(timeout);
        this.channels.set(peerId, channel);
        resolve(channel);
      };
    });
  }

  async send(peerId, encryptedData) {
    // Try P2P first
    const channel = this.channels.get(peerId);
    if (channel?.readyState === 'open') {
      channel.send(encryptedData);
      return { transport: 'p2p' };
    }

    // Try to establish P2P
    try {
      const newChannel = await this.connectToPeer(peerId);
      newChannel.send(encryptedData);
      return { transport: 'p2p' };
    } catch (e) {
      // Fall back to relay
      this.crypto.relay.push("encrypted_message", {
        to: peerId,
        data: encryptedData
      });
      return { transport: 'relay' };
    }
  }
}
```

#### 2.3 STUN/TURN Infrastructure

**Option A: Self-hosted coturn** (~$20/mo VPS)
```yaml
# docker-compose.yml addition
coturn:
  image: coturn/coturn:latest
  ports:
    - "3478:3478/udp"
    - "3478:3478/tcp"
  environment:
    - TURN_REALM=loka.game
    - TURN_SECRET=${TURN_SECRET}
```

**Option B: Cloud service** (Twilio, Xirsys)
- STUN: Free
- TURN: ~$0.40/GB (negligible for text chat)

### Phase 3: Group Chat (2-3 weeks)

**Goal:** Encrypted party and guild chat

#### 3.1 Group Management

```javascript
class LokaCrypto {
  async createGroup(groupId, memberIds) {
    // Create MLS group
    await this.cc.createConversation(groupId, {
      // Group config
    });

    // Add all members
    const keyPackages = await Promise.all(
      memberIds.map(id => this.fetchKeyPackage(id))
    );

    const { welcome, commit } = await this.cc.addClientsToConversation(
      groupId,
      keyPackages
    );

    // Send welcome to each new member
    for (const memberId of memberIds) {
      await this.sendWelcome(memberId, welcome);
    }

    return groupId;
  }

  async joinGroup(groupId, welcomeMessage) {
    // Process welcome message to join group
    await this.cc.processWelcomeMessage(welcomeMessage, {
      // Config
    });
  }

  async sendGroupMessage(groupId, message) {
    const encrypted = await this.cc.encrypt(
      groupId,
      new TextEncoder().encode(message)
    );

    // Send to all group members via P2P or relay
    const members = await this.getGroupMembers(groupId);
    for (const memberId of members) {
      if (memberId !== this.clientId) {
        await this.transport.send(memberId, encrypted);
      }
    }
  }

  async removeFromGroup(groupId, memberId) {
    // Remove member and rotate keys
    const { commit } = await this.cc.removeClientsFromConversation(
      groupId,
      [memberId]
    );

    // Distribute commit to remaining members
    const members = await this.getGroupMembers(groupId);
    for (const member of members) {
      await this.transport.send(member, commit);
    }
  }
}
```

#### 3.2 Mesh Topology for Groups

```javascript
class GroupP2PManager {
  constructor(p2pManager) {
    this.p2p = p2pManager;
    this.groupConnections = new Map(); // groupId -> Set<peerId>
  }

  async setupGroupMesh(groupId, memberIds) {
    const connections = new Set();

    // For small groups (≤8): full mesh
    // For large groups (>8): connect to random subset
    const targetConnections = memberIds.length <= 8
      ? memberIds
      : this.selectRandomPeers(memberIds, 5);

    for (const peerId of targetConnections) {
      try {
        await this.p2p.connectToPeer(peerId);
        connections.add(peerId);
      } catch (e) {
        console.warn(`Failed to connect to ${peerId}, will use relay`);
      }
    }

    this.groupConnections.set(groupId, connections);
  }

  async broadcastToGroup(groupId, encryptedData) {
    const connections = this.groupConnections.get(groupId) || new Set();

    for (const peerId of connections) {
      await this.p2p.send(peerId, encryptedData);
    }
  }
}
```

### Phase 4: Mobile Support (When Un-shelved)

**Goal:** Same encryption on React Native

Wire Core Crypto provides native bindings:

```javascript
// React Native
import { CoreCrypto } from '@wireapp/core-crypto-rn';

// Same API as web!
const cc = await CoreCrypto.init({
  databaseName: 'loka-mls',
  key: await getSecureKey(), // From Keychain/Keystore
  clientId: playerId
});
```

**Key storage:**
- iOS: Keychain (via `react-native-keychain`)
- Android: Keystore (via `react-native-keychain`)

**P2P:**
- Use `react-native-webrtc`
- May need TURN more often (carrier NAT)

---

## Key Management

### Key Storage by Platform

| Platform | Storage Location | Encryption | Backup |
|----------|------------------|------------|--------|
| Web | IndexedDB | AES-256-GCM (derived from player secret) | Optional export |
| iOS | Keychain | System encryption | iCloud Keychain (optional) |
| Android | Keystore | Hardware-backed | Google Backup (optional) |

### Key Packages

Each player maintains a pool of "key packages" - pre-generated public keys:
- Uploaded to server periodically (5-10 at a time)
- Consumed when someone adds them to a group
- Prevents need for both parties to be online

```javascript
// Maintain key package pool
async maintainKeyPackages() {
  const MIN_PACKAGES = 5;

  const available = await this.getAvailablePackageCount();
  if (available < MIN_PACKAGES) {
    const newPackages = await this.cc.clientKeypackages(MIN_PACKAGES - available);
    for (const pkg of newPackages) {
      await this.uploadKeyPackage(pkg);
    }
  }
}
```

### Key Recovery

**Options:**

1. **Ephemeral (Default)**: Lost device = lost history, but new messages work
2. **Recovery Phrase**: User exports 24-word phrase, can restore on new device
3. **Cross-Device Sync**: Scan QR code on old device to sync keys

**Recommendation:** Start with ephemeral, add recovery phrase as optional feature.

---

## Privacy & Metadata

### What the Server Knows

Even with E2E encryption and P2P:
- **Who is online** (connection state)
- **Who is in what group** (membership metadata)
- **When encrypted blobs are sent** (if using relay)
- **WebRTC signaling** (who tries to connect to whom)

### What the Server CANNOT Know

- **Message content** (encrypted)
- **Message content over P2P** (doesn't even see the blobs)
- **Group conversation content**
- **Any decrypted data**

### Reducing Metadata (Future)

For the truly paranoid (not in MVP):
- **Padding**: Fixed-size messages hide length
- **Chaff**: Periodic dummy messages hide timing
- **Onion routing**: Messages hop through peers

---

## Cost Estimates

### STUN/TURN Infrastructure

| Component | Self-Hosted | Cloud Service |
|-----------|-------------|---------------|
| STUN | Free (coturn) | Free (Google) |
| TURN | ~$20/mo VPS | $0.40/GB (Twilio) |

**Estimate:** 100 players, 10% need TURN, 1KB/message, 100 messages/day
- 100 × 0.1 × 1KB × 100 = 1MB/day = 30MB/month
- Cost: ~$0.01/month (negligible)

### Client Size Impact

| Component | Size (gzipped) |
|-----------|----------------|
| Wire Core Crypto (WASM) | ~500KB-1MB |
| P2P manager code | ~5KB |
| **Total additional** | ~500KB-1MB |

This is acceptable for a game client. For comparison, WhatsApp Web loads ~2MB.

---

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Server compromise | MLS encryption (can't read messages) |
| MITM on P2P | DTLS + MLS identity verification |
| Key theft | Secure storage, epoch rotation |
| Replay attacks | MLS epoch + message counters |
| Impersonation | MLS credential verification |
| Removed member reads future | Epoch key rotation on removal |

### What This Doesn't Protect Against

- Compromised client device (malware)
- User sharing decrypted messages
- Screenshots/screen recording
- Social engineering

### Abuse & Moderation

**Challenge:** Can't moderate what you can't read

**Solutions:**
1. **User reporting**: Recipient can report (includes decrypted message)
2. **Metadata-based detection**: Unusual patterns (spam bots)
3. **Public channels remain moderated**: Only private channels encrypted
4. **Terms of service**: Users agree not to abuse private channels

---

## Open Questions

1. **Key backup UX**: How do we make recovery phrase optional but discoverable?
2. **Offline message queue**: How long does server hold encrypted blobs for offline users?
3. **Guild officer key rotation**: When guild leadership changes, how do we handle it?
4. **Cross-device sync**: When mobile launches, how do web + mobile share identity?
5. **Message history on new device**: Can new device see old messages? (Probably not, for security)

---

## Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1: Foundation** | 1-2 weeks | Encrypted 1:1 tells working |
| **Phase 2: P2P Transport** | 2-3 weeks | WebRTC direct connections |
| **Phase 3: Group Chat** | 2-3 weeks | Party/guild encryption |
| **Phase 4: Polish** | 1-2 weeks | Key management UX, edge cases |
| **Total** | 6-10 weeks | Full encrypted chat system |

---

## Summary

**Technology choices:**

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Encryption** | MLS via Wire Core Crypto | RFC 9420, efficient groups, production-tested |
| **Transport (Primary)** | WebRTC Data Channels | True P2P, low latency |
| **Transport (Fallback)** | Phoenix WebSocket | Always works, encrypted blobs |
| **Key Storage (Web)** | Encrypted IndexedDB | Built into Wire Core Crypto |
| **Key Storage (Mobile)** | Keychain/Keystore | Native secure storage |

**Result:** Players can communicate securely, knowing:
- Server operator can't read their messages
- Conversations are truly private
- P2P means many messages never touch the server
- Thematically appropriate for a game about inner peace

**Trade-offs accepted:**
- Larger client (~500KB-1MB additional for WASM)
- Key management complexity (mitigated by good UX)
- Limited moderation for private channels
- TURN costs (minimal)

---

## References

- [RFC 9420 - MLS Protocol](https://datatracker.ietf.org/doc/rfc9420/)
- [Wire Core Crypto](https://github.com/wireapp/core-crypto)
- [@wireapp/core-crypto on NPM](https://www.npmjs.com/package/@wireapp/core-crypto)
- [OpenMLS](https://github.com/openmls/openmls)
- [OpenMLS Book](https://book.openmls.tech)
- [WebRTC Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)
- [MLS Architecture](https://messaginglayersecurity.rocks/)
