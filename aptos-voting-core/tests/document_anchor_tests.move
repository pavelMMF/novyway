#[test_only]
module aptos_voting::document_anchor_tests {
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_voting::document_anchor;
    use aptos_voting::weighted_voting;

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting)]
    fun anchors_initial_document_and_exposes_head(aptos_framework: &signer, creator: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        document_anchor::initialize(creator);
        document_anchor::anchor_document(
            creator, hash32(1), hash32(2), vector::empty(), hash32(3), vector::empty(),
            123, b"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"sovet-online://documents/charter.json", b"2026.07.14",
        );
        assert!(document_anchor::is_initialized() && document_anchor::anchor_count() == 1, 2001);
        let (found, anchor_id, revision, content_hash) = document_anchor::document_head(hash32(1));
        assert!(found && anchor_id == 0 && revision == 1 && content_hash == hash32(2), 2002);
        let (_, stored_revision, stored_content_hash, parent, metadata_hash, recovery, size, mime, uri, version, actor, _) = document_anchor::anchor(0);
        assert!(stored_revision == 1 && stored_content_hash == hash32(2) && vector::length(&parent) == 0, 2003);
        assert!(metadata_hash == hash32(3) && vector::length(&recovery) == 0 && size == 123, 2004);
        assert!(mime == b"application/vnd.openxmlformats-officedocument.wordprocessingml.document", 2005);
        assert!(uri == b"sovet-online://documents/charter.json" && version == b"2026.07.14" && actor == signer::address_of(creator), 2006);
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting)]
    fun revision_must_name_the_current_parent(aptos_framework: &signer, creator: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        document_anchor::initialize(creator);
        anchor(creator, hash32(1), hash32(2), vector::empty(), hash32(3), vector::empty());
        anchor(creator, hash32(1), hash32(4), hash32(2), hash32(5), vector::empty());
        let (found, anchor_id, revision, content_hash) = document_anchor::document_head(hash32(1));
        assert!(found && anchor_id == 1 && revision == 2 && content_hash == hash32(4), 2101);
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting)]
    #[expected_failure(abort_code = 10, location = aptos_voting::document_anchor)]
    fun rejects_stale_parent(aptos_framework: &signer, creator: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        document_anchor::initialize(creator);
        anchor(creator, hash32(1), hash32(2), vector::empty(), hash32(3), vector::empty());
        anchor(creator, hash32(1), hash32(4), hash32(9), hash32(5), vector::empty());
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting, stranger = @0x99)]
    #[expected_failure(abort_code = 3, location = aptos_voting::document_anchor)]
    fun rejects_non_admin(aptos_framework: &signer, creator: &signer, stranger: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        document_anchor::initialize(creator);
        anchor(stranger, hash32(1), hash32(2), vector::empty(), hash32(3), vector::empty());
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting)]
    #[expected_failure(abort_code = 11, location = aptos_voting::document_anchor)]
    fun rejects_recovery_hash_for_existing_document(aptos_framework: &signer, creator: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        document_anchor::initialize(creator);
        anchor(creator, hash32(1), hash32(2), vector::empty(), hash32(3), vector::empty());
        anchor(creator, hash32(1), hash32(4), hash32(2), hash32(5), hash32(6));
    }

    fun anchor(
        admin: &signer,
        document_key: vector<u8>,
        content_hash: vector<u8>,
        parent_hash: vector<u8>,
        metadata_hash: vector<u8>,
        recovery_hash: vector<u8>,
    ) {
        document_anchor::anchor_document(
            admin, document_key, content_hash, parent_hash, metadata_hash, recovery_hash,
            100, b"application/test", b"sovet-online://documents/test.json", b"test-v1",
        );
    }

    fun start_time(aptos_framework: &signer) {
        timestamp::set_time_has_started_for_testing(aptos_framework);
    }

    fun hash32(value: u8): vector<u8> {
        let output = vector::empty<u8>();
        let index = 0;
        while (index < 32) {
            vector::push_back(&mut output, value);
            index = index + 1;
        };
        output
    }
}
