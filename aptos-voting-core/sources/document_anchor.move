module aptos_voting::document_anchor {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use aptos_voting::weighted_voting;

    const SHA256_BYTES: u64 = 32;
    const MAX_DOCUMENT_KEY_BYTES: u64 = 64;
    const MAX_VERSION_BYTES: u64 = 64;
    const MAX_MIME_BYTES: u64 = 128;
    const MAX_URI_BYTES: u64 = 1_024;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_PUBLISHER: u64 = 2;
    const E_NOT_ADMIN: u64 = 3;
    const E_BAD_DOCUMENT_KEY: u64 = 4;
    const E_BAD_HASH: u64 = 5;
    const E_BAD_METADATA: u64 = 6;
    const E_BAD_URI: u64 = 7;
    const E_ANCHOR_NOT_FOUND: u64 = 8;
    const E_DOCUMENT_EXISTS: u64 = 9;
    const E_BAD_PARENT: u64 = 10;
    const E_BAD_RECOVERY: u64 = 11;

    struct Registry has key {
        next_anchor_id: u64,
        anchors: Table<u64, Anchor>,
        heads: Table<vector<u8>, Head>,
    }

    /// Immutable Testnet evidence for exactly one binary document version.
    struct Anchor has store {
        id: u64,
        document_key: vector<u8>,
        revision: u64,
        content_hash: vector<u8>,
        parent_content_hash: vector<u8>,
        metadata_hash: vector<u8>,
        recovery_bundle_hash: vector<u8>,
        content_bytes: u64,
        mime_type: vector<u8>,
        metadata_uri: vector<u8>,
        version: vector<u8>,
        anchored_by: address,
        anchored_at_secs: u64,
    }

    struct Head has copy, drop, store {
        anchor_id: u64,
        revision: u64,
        content_hash: vector<u8>,
    }

    #[event]
    struct DocumentAnchored has drop, store {
        anchor_id: u64,
        document_key: vector<u8>,
        revision: u64,
        content_hash: vector<u8>,
        parent_content_hash: vector<u8>,
        metadata_hash: vector<u8>,
        recovery_bundle_hash: vector<u8>,
        anchored_by: address,
    }

    /// Creates the registry at the package address. It is deliberately a
    /// separate action after a package upgrade so initialization is observable.
    public entry fun initialize(publisher: &signer) {
        let publisher_address = signer::address_of(publisher);
        assert!(publisher_address == @aptos_voting, E_NOT_PUBLISHER);
        assert!(!exists<Registry>(@aptos_voting), E_ALREADY_INITIALIZED);
        assert!(weighted_voting::is_initialized(), E_NOT_ADMIN);
        assert!(weighted_voting::is_admin(publisher_address), E_NOT_ADMIN);
        move_to(publisher, Registry {
            next_anchor_id: 0,
            anchors: table::new(),
            heads: table::new(),
        });
    }

    /// Adds a new immutable document version. A document key is a SHA-256 of
    /// the stable logical slug, not a filename. Later revisions must name the
    /// previous content hash, preventing silent replacement or branching.
    ///
    /// `recovery_bundle_hash` is empty for the first Testnet generation. After
    /// a reset it contains the SHA-256 of the archived predecessor bundle.
    public entry fun anchor_document(
        admin: &signer,
        document_key: vector<u8>,
        content_hash: vector<u8>,
        parent_content_hash: vector<u8>,
        metadata_hash: vector<u8>,
        recovery_bundle_hash: vector<u8>,
        content_bytes: u64,
        mime_type: vector<u8>,
        metadata_uri: vector<u8>,
        version: vector<u8>,
    ) acquires Registry {
        let actor = signer::address_of(admin);
        assert!(weighted_voting::is_admin(actor), E_NOT_ADMIN);
        assert!(vector::length(&document_key) == SHA256_BYTES, E_BAD_DOCUMENT_KEY);
        assert!(vector::length(&content_hash) == SHA256_BYTES, E_BAD_HASH);
        assert!(vector::length(&metadata_hash) == SHA256_BYTES, E_BAD_HASH);
        assert!(vector::length(&parent_content_hash) == 0 || vector::length(&parent_content_hash) == SHA256_BYTES, E_BAD_PARENT);
        assert!(vector::length(&recovery_bundle_hash) == 0 || vector::length(&recovery_bundle_hash) == SHA256_BYTES, E_BAD_RECOVERY);
        assert!(content_bytes > 0, E_BAD_METADATA);
        assert!(vector::length(&mime_type) > 0 && vector::length(&mime_type) <= MAX_MIME_BYTES, E_BAD_METADATA);
        assert!(vector::length(&metadata_uri) > 0 && vector::length(&metadata_uri) <= MAX_URI_BYTES, E_BAD_URI);
        assert!(vector::length(&version) > 0 && vector::length(&version) <= MAX_VERSION_BYTES, E_BAD_METADATA);

        let registry = borrow_global_mut<Registry>(@aptos_voting);
        let has_head = table::contains(&registry.heads, copy_bytes(&document_key));
        let revision = if (has_head) {
            let head = table::borrow(&registry.heads, copy_bytes(&document_key));
            assert!(vector::length(&recovery_bundle_hash) == 0, E_BAD_RECOVERY);
            assert!(vector::length(&parent_content_hash) == SHA256_BYTES && vector::length(&parent_content_hash) == vector::length(&head.content_hash), E_BAD_PARENT);
            assert!(bytes_equal(&parent_content_hash, &head.content_hash), E_BAD_PARENT);
            head.revision + 1
        } else {
            assert!(vector::length(&parent_content_hash) == 0, E_BAD_PARENT);
            1
        };

        let id = registry.next_anchor_id;
        registry.next_anchor_id = id + 1;
        let now = timestamp::now_seconds();
        table::add(&mut registry.anchors, id, Anchor {
            id,
            document_key: copy_bytes(&document_key),
            revision,
            content_hash: copy_bytes(&content_hash),
            parent_content_hash: copy_bytes(&parent_content_hash),
            metadata_hash: copy_bytes(&metadata_hash),
            recovery_bundle_hash: copy_bytes(&recovery_bundle_hash),
            content_bytes,
            mime_type,
            metadata_uri,
            version,
            anchored_by: actor,
            anchored_at_secs: now,
        });

        if (has_head) {
            let head = table::borrow_mut(&mut registry.heads, copy_bytes(&document_key));
            head.anchor_id = id;
            head.revision = revision;
            head.content_hash = copy_bytes(&content_hash);
        } else {
            table::add(&mut registry.heads, copy_bytes(&document_key), Head { anchor_id: id, revision, content_hash: copy_bytes(&content_hash) });
        };

        event::emit(DocumentAnchored {
            anchor_id: id,
            document_key,
            revision,
            content_hash,
            parent_content_hash,
            metadata_hash,
            recovery_bundle_hash,
            anchored_by: actor,
        });
    }

    #[view]
    public fun is_initialized(): bool { exists<Registry>(@aptos_voting) }

    #[view]
    public fun anchor_count(): u64 acquires Registry {
        borrow_global<Registry>(@aptos_voting).next_anchor_id
    }

    #[view]
    public fun document_head(document_key: vector<u8>): (bool, u64, u64, vector<u8>) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        if (!table::contains(&registry.heads, copy_bytes(&document_key))) return (false, 0, 0, vector::empty());
        let head = table::borrow(&registry.heads, copy_bytes(&document_key));
        (true, head.anchor_id, head.revision, copy_bytes(&head.content_hash))
    }

    #[view]
    public fun anchor(anchor_id: u64): (
        vector<u8>, u64, vector<u8>, vector<u8>, vector<u8>, vector<u8>, u64, vector<u8>, vector<u8>, vector<u8>, address, u64
    ) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        assert!(table::contains(&registry.anchors, anchor_id), E_ANCHOR_NOT_FOUND);
        let record = table::borrow(&registry.anchors, anchor_id);
        (
            copy_bytes(&record.document_key),
            record.revision,
            copy_bytes(&record.content_hash),
            copy_bytes(&record.parent_content_hash),
            copy_bytes(&record.metadata_hash),
            copy_bytes(&record.recovery_bundle_hash),
            record.content_bytes,
            copy_bytes(&record.mime_type),
            copy_bytes(&record.metadata_uri),
            copy_bytes(&record.version),
            record.anchored_by,
            record.anchored_at_secs,
        )
    }

    fun copy_bytes(source: &vector<u8>): vector<u8> {
        let result = vector::empty();
        let index = 0;
        while (index < vector::length(source)) {
            vector::push_back(&mut result, *vector::borrow(source, index));
            index = index + 1;
        };
        result
    }

    fun bytes_equal(left: &vector<u8>, right: &vector<u8>): bool {
        if (vector::length(left) != vector::length(right)) return false;
        let index = 0;
        while (index < vector::length(left)) {
            if (*vector::borrow(left, index) != *vector::borrow(right, index)) return false;
            index = index + 1;
        };
        true
    }
}
