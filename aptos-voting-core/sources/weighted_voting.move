module aptos_voting::weighted_voting {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};

    const BPS_DENOMINATOR: u64 = 10_000;
    const WEIGHT_SCALE: u64 = 1_000_000;
    const DEFAULT_PASS_BPS: u64 = 5_000;
    const DEFAULT_QUORUM_BPS: u64 = 4_000;
    const MAX_ADMINS: u64 = 31;
    const MAX_CATEGORY_NAME_BYTES: u64 = 128;
    const MAX_URI_BYTES: u64 = 1_024;
    const MAX_ELECTION_DURATION_SECS: u64 = 31_536_000;
    const MAX_PROPOSAL_LIFETIME_SECS: u64 = 2_592_000;
    /// Half a year in seconds (365.25 / 2 days). One degradation period.
    const DEGRADE_PERIOD_SECS: u64 = 15_778_800;
    /// Weight retained per elapsed period: 85% (a 15% decay every half year).
    const DEGRADE_KEEP_BPS: u64 = 8_500;
    /// Loop bound for the decay computation (~30 years). Beyond this the
    /// multiplier is far below any reachable lower bound anyway.
    const MAX_DEGRADE_PERIODS: u64 = 60;

    const STATUS_PENDING: u8 = 0;
    const STATUS_EXECUTED: u8 = 1;
    const STATUS_FINALIZED: u8 = 1;
    const ADMIN_ADDED: u8 = 1;
    const ADMIN_REMOVED: u8 = 2;
    const CATEGORY_CREATED: u8 = 1;
    const CATEGORY_STATUS_CHANGED: u8 = 2;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_NOT_CREATOR: u64 = 3;
    const E_NOT_ADMIN: u64 = 4;
    const E_ADMIN_EXISTS: u64 = 5;
    const E_ADMIN_NOT_FOUND: u64 = 6;
    const E_LAST_ADMIN: u64 = 7;
    const E_TOO_MANY_ADMINS: u64 = 8;
    const E_CATEGORY_NOT_FOUND: u64 = 9;
    const E_CATEGORY_INACTIVE: u64 = 10;
    const E_BAD_METADATA: u64 = 11;
    const E_BAD_POLICY: u64 = 12;
    const E_BAD_PROPOSAL_EXPIRY: u64 = 13;
    const E_PROPOSAL_NOT_FOUND: u64 = 14;
    const E_PROPOSAL_NOT_PENDING: u64 = 15;
    const E_STALE_COUNCIL: u64 = 16;
    const E_ALREADY_APPROVED: u64 = 17;
    const E_ELECTION_NOT_FOUND: u64 = 18;
    const E_BAD_ELECTION_WINDOW: u64 = 19;
    const E_BAD_PASS_THRESHOLD: u64 = 20;
    const E_BAD_ALLOCATION: u64 = 21;
    const E_ELECTION_NOT_OPEN: u64 = 22;
    const E_NO_VOTING_WEIGHT: u64 = 23;
    const E_REVOTE_DISABLED: u64 = 24;
    const E_ELECTION_NOT_ENDED: u64 = 25;
    const E_ELECTION_FINALIZED: u64 = 26;
    const E_NOT_MODULE_PUBLISHER: u64 = 27;
    const E_VOTE_NOT_FOUND: u64 = 28;
    const E_HISTORY_NOT_FOUND: u64 = 29;
    const E_ZERO_ADDRESS: u64 = 30;
    const E_BAD_LEVEL: u64 = 31;
    const E_BAD_MANUAL_WEIGHT: u64 = 32;
    const E_NO_LEVEL_ZERO_MEMBERS: u64 = 33;
    const E_MANUAL_TOTAL_EXCEEDS_TARGET: u64 = 34;
    const E_DERIVED_WEIGHT_ABOVE_CAP: u64 = 36;
    const E_BAD_QUORUM_BPS: u64 = 37;
    const E_CANNOT_REMOVE_CREATOR: u64 = 38;

    struct Governance has key {
        creator: address,
        admins: vector<address>,
        council_epoch: u64,
        policy_version: u64,
        membership_version: u64,
        default_pass_bps: u64,
        next_category_id: u64,
        next_admin_change_id: u64,
        next_category_change_id: u64,
        next_policy_proposal_id: u64,
        next_policy_change_id: u64,
        next_qualification_proposal_id: u64,
        next_qualification_change_id: u64,
        next_election_id: u64,
        categories: Table<u64, Category>,
        admin_changes: Table<u64, AdminChange>,
        category_changes: Table<u64, CategoryChange>,
        policy_proposals: Table<u64, PolicyProposal>,
        policy_changes: Table<u64, PolicyChange>,
        qualification_proposals: Table<u64, QualificationProposal>,
        qualification_changes: Table<u64, QualificationChange>,
        qualifications: Table<address, AccountQualifications>,
        elections: Table<u64, Election>,
    }

    struct Category has store {
        id: u64,
        name: vector<u8>,
        metadata_uri: vector<u8>,
        active: bool,
        policy_version: u64,
        quotas: vector<u64>,
        floors: vector<u64>,
        max_individual_weight: u64,
        counts: vector<u64>,
        manual_counts: vector<u64>,
        manual_sums: vector<u64>,
        created_at_secs: u64,
        updated_at_secs: u64,
    }

    struct AdminChange has copy, drop, store {
        id: u64,
        action: u8,
        admin: address,
        actor: address,
        council_epoch: u64,
        admin_count: u64,
        threshold: u64,
        changed_at_secs: u64,
    }

    struct CategoryChange has copy, drop, store {
        id: u64,
        action: u8,
        category_id: u64,
        actor: address,
        active: bool,
        metadata_hash: vector<u8>,
        changed_at_secs: u64,
    }

    struct PolicyProposal has copy, drop, store {
        id: u64,
        council_epoch: u64,
        proposer: address,
        category_id: u64,
        quotas: vector<u64>,
        floors: vector<u64>,
        max_individual_weight: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
        approvals: vector<address>,
        created_at_secs: u64,
        expires_at_secs: u64,
        status: u8,
    }

    struct PolicyChange has copy, drop, store {
        id: u64,
        proposal_id: u64,
        category_id: u64,
        policy_version: u64,
        quotas: vector<u64>,
        floors: vector<u64>,
        max_individual_weight: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
        changed_at_secs: u64,
    }

    struct QualificationProposal has copy, drop, store {
        id: u64,
        council_epoch: u64,
        proposer: address,
        account: address,
        category_id: u64,
        level: u8,
        eligible: bool,
        evidence_hash: vector<u8>,
        manual_weight: u64,
        reason_uri: vector<u8>,
        approvals: vector<address>,
        created_at_secs: u64,
        expires_at_secs: u64,
        status: u8,
    }

    struct QualificationRevision has copy, drop, store {
        membership_version: u64,
        level: u8,
        eligible: bool,
        evidence_hash: vector<u8>,
        manual_weight: u64,
        change_id: u64,
        changed_at_secs: u64,
    }

    struct AccountQualifications has store {
        by_category: Table<u64, vector<QualificationRevision>>,
    }

    struct QualificationChange has copy, drop, store {
        id: u64,
        proposal_id: u64,
        account: address,
        category_id: u64,
        old_level: u8,
        old_eligible: bool,
        old_manual_weight: u64,
        new_level: u8,
        new_eligible: bool,
        new_manual_weight: u64,
        membership_version: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
        changed_at_secs: u64,
    }

    struct Election has store {
        id: u64,
        created_by: address,
        category_id: u64,
        metadata_hash: vector<u8>,
        metadata_uri: vector<u8>,
        membership_version: u64,
        policy_version: u64,
        quotas: vector<u64>,
        floors: vector<u64>,
        max_individual_weight: u64,
        counts: vector<u64>,
        manual_counts: vector<u64>,
        manual_sums: vector<u64>,
        targets: vector<u64>,
        derived_weights: vector<u64>,
        remainders: vector<u64>,
        eligible_total: u64,
        pass_bps: u64,
        quorum_bps: u64,
        quorum_weight: u64,
        allow_revote: bool,
        starts_at_secs: u64,
        ends_at_secs: u64,
        status: u8,
        yes_units: u128,
        no_units: u128,
        abstain_units: u128,
        unique_voters: u64,
        next_revision_id: u64,
        passed: bool,
        quorum_met: bool,
        finalized_at_secs: u64,
        votes: Table<address, VoteRecord>,
        revisions: Table<u64, VoteRevision>,
    }

    struct VoteRecord has copy, drop, store {
        revision: u64,
        weight: u64,
        multiplier_bps: u64,
        yes_bps: u64,
        no_bps: u64,
        abstain_bps: u64,
        cast_at_secs: u64,
    }

    /// Stored only for superseded ballots (a re-vote replaced them). The
    /// current ballot lives in `Election.votes`; first-time votes therefore
    /// occupy a single storage slot instead of two.
    struct VoteRevision has copy, drop, store {
        voter: address,
        revision: u64,
        weight: u64,
        multiplier_bps: u64,
        yes_bps: u64,
        no_bps: u64,
        abstain_bps: u64,
        cast_at_secs: u64,
        replaced_at_secs: u64,
    }

    #[event]
    struct GovernanceInitialized has drop, store {
        creator: address,
        initial_admin: address,
        council_epoch: u64,
        policy_version: u64,
        membership_version: u64,
    }

    #[event]
    struct AdminChanged has drop, store {
        change_id: u64,
        action: u8,
        admin: address,
        actor: address,
        council_epoch: u64,
        admin_count: u64,
        threshold: u64,
    }

    #[event]
    struct CategoryChanged has drop, store {
        change_id: u64,
        action: u8,
        category_id: u64,
        actor: address,
        active: bool,
        metadata_hash: vector<u8>,
    }

    #[event]
    struct PolicyChangeProposed has drop, store {
        proposal_id: u64,
        council_epoch: u64,
        proposer: address,
        category_id: u64,
        quotas: vector<u64>,
        floors: vector<u64>,
        max_individual_weight: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
        expires_at_secs: u64,
    }

    #[event]
    struct PolicyChangeApproved has drop, store {
        proposal_id: u64,
        approver: address,
        approvals: u64,
        threshold: u64,
    }

    #[event]
    struct PolicyChanged has drop, store {
        change_id: u64,
        proposal_id: u64,
        category_id: u64,
        policy_version: u64,
        quotas: vector<u64>,
        floors: vector<u64>,
        max_individual_weight: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
    }

    #[event]
    struct QualificationProposed has drop, store {
        proposal_id: u64,
        council_epoch: u64,
        proposer: address,
        account: address,
        category_id: u64,
        level: u8,
        eligible: bool,
        evidence_hash: vector<u8>,
        manual_weight: u64,
        reason_uri: vector<u8>,
        expires_at_secs: u64,
    }

    #[event]
    struct QualificationApproved has drop, store {
        proposal_id: u64,
        approver: address,
        approvals: u64,
        threshold: u64,
    }

    #[event]
    struct QualificationChanged has drop, store {
        change_id: u64,
        proposal_id: u64,
        account: address,
        category_id: u64,
        old_level: u8,
        old_eligible: bool,
        old_manual_weight: u64,
        new_level: u8,
        new_eligible: bool,
        new_manual_weight: u64,
        membership_version: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
    }

    #[event]
    struct ElectionCreated has drop, store {
        election_id: u64,
        creator: address,
        category_id: u64,
        membership_version: u64,
        policy_version: u64,
        counts: vector<u64>,
        targets: vector<u64>,
        derived_weights: vector<u64>,
        remainders: vector<u64>,
        eligible_total: u64,
        pass_bps: u64,
        quorum_bps: u64,
        quorum_weight: u64,
        starts_at_secs: u64,
        ends_at_secs: u64,
    }

    #[event]
    struct VoteCast has drop, store {
        election_id: u64,
        voter: address,
        revision: u64,
        weight: u64,
        multiplier_bps: u64,
        yes_bps: u64,
        no_bps: u64,
        abstain_bps: u64,
    }

    #[event]
    struct ElectionFinalized has drop, store {
        election_id: u64,
        quorum_met: bool,
        passed: bool,
        yes_units: u128,
        no_units: u128,
        abstain_units: u128,
        finalized_at_secs: u64,
    }

    public entry fun initialize(creator: &signer) {
        let creator_address = signer::address_of(creator);
        assert!(creator_address == @aptos_voting, E_NOT_MODULE_PUBLISHER);
        assert!(!exists<Governance>(@aptos_voting), E_ALREADY_INITIALIZED);
        let now = timestamp::now_seconds();
        let categories = table::new<u64, Category>();
        table::add(&mut categories, 0, Category {
            id: 0,
            name: b"General",
            metadata_uri: vector::empty(),
            active: true,
            policy_version: 1,
            quotas: four(10_000, 0, 0, 0),
            floors: four(0, 0, 0, 0),
            max_individual_weight: WEIGHT_SCALE,
            counts: four(0, 0, 0, 0),
            manual_counts: four(0, 0, 0, 0),
            manual_sums: four(0, 0, 0, 0),
            created_at_secs: now,
            updated_at_secs: now,
        });
        let gov = Governance {
            creator: creator_address,
            admins: vector[creator_address],
            council_epoch: 1,
            policy_version: 1,
            membership_version: 0,
            default_pass_bps: DEFAULT_PASS_BPS,
            next_category_id: 1,
            next_admin_change_id: 1,
            next_category_change_id: 1,
            next_policy_proposal_id: 0,
            next_policy_change_id: 0,
            next_qualification_proposal_id: 0,
            next_qualification_change_id: 0,
            next_election_id: 0,
            categories,
            admin_changes: table::new(),
            category_changes: table::new(),
            policy_proposals: table::new(),
            policy_changes: table::new(),
            qualification_proposals: table::new(),
            qualification_changes: table::new(),
            qualifications: table::new(),
            elections: table::new(),
        };
        move_to(creator, gov);
        let stored = borrow_global_mut<Governance>(@aptos_voting);
        record_admin_change(stored, ADMIN_ADDED, creator_address, creator_address);
        record_category_change(stored, CATEGORY_CREATED, 0, creator_address, true, vector::empty());
        event::emit(GovernanceInitialized {
            creator: creator_address,
            initial_admin: creator_address,
            council_epoch: 1,
            policy_version: 1,
            membership_version: 0,
        });
    }

    public entry fun add_admin(creator: &signer, admin: address) acquires Governance {
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let actor = signer::address_of(creator);
        assert!(actor == gov.creator, E_NOT_CREATOR);
        assert!(admin != @0x0, E_ZERO_ADDRESS);
        assert!(!is_admin_internal(&gov.admins, admin), E_ADMIN_EXISTS);
        assert!(vector::length(&gov.admins) < MAX_ADMINS, E_TOO_MANY_ADMINS);
        vector::push_back(&mut gov.admins, admin);
        gov.council_epoch = gov.council_epoch + 1;
        record_admin_change(gov, ADMIN_ADDED, admin, actor);
    }

    public entry fun remove_admin(creator: &signer, admin: address) acquires Governance {
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let actor = signer::address_of(creator);
        assert!(actor == gov.creator, E_NOT_CREATOR);
        assert!(admin != gov.creator, E_CANNOT_REMOVE_CREATOR);
        assert!(vector::length(&gov.admins) > 1, E_LAST_ADMIN);
        let (found, index) = find_admin(&gov.admins, admin);
        assert!(found, E_ADMIN_NOT_FOUND);
        vector::remove(&mut gov.admins, index);
        gov.council_epoch = gov.council_epoch + 1;
        record_admin_change(gov, ADMIN_REMOVED, admin, actor);
    }

    public entry fun create_category(
        admin: &signer,
        name: vector<u8>,
        metadata_uri: vector<u8>,
        metadata_hash: vector<u8>,
        q0: u64,
        q1: u64,
        q2: u64,
        q3: u64,
        floor0: u64,
        floor1: u64,
        floor2: u64,
        floor3: u64,
        max_individual_weight: u64,
    ) acquires Governance {
        assert!(vector::length(&name) > 0 && vector::length(&name) <= MAX_CATEGORY_NAME_BYTES, E_BAD_METADATA);
        assert!(vector::length(&metadata_uri) <= MAX_URI_BYTES, E_BAD_METADATA);
        assert_hash_or_empty(&metadata_hash);
        let quotas = four(q0, q1, q2, q3);
        let floors = four(floor0, floor1, floor2, floor3);
        assert_policy(&quotas, &floors, max_individual_weight);
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let actor = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, actor), E_NOT_ADMIN);
        gov.policy_version = gov.policy_version + 1;
        let id = gov.next_category_id;
        gov.next_category_id = id + 1;
        let now = timestamp::now_seconds();
        table::add(&mut gov.categories, id, Category {
            id,
            name,
            metadata_uri,
            active: true,
            policy_version: gov.policy_version,
            quotas,
            floors,
            max_individual_weight,
            counts: four(0, 0, 0, 0),
            manual_counts: four(0, 0, 0, 0),
            manual_sums: four(0, 0, 0, 0),
            created_at_secs: now,
            updated_at_secs: now,
        });
        record_category_change(gov, CATEGORY_CREATED, id, actor, true, metadata_hash);
    }

    public entry fun set_category_active(
        admin: &signer,
        category_id: u64,
        active: bool,
        metadata_hash: vector<u8>,
    ) acquires Governance {
        assert_hash_or_empty(&metadata_hash);
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let actor = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, actor), E_NOT_ADMIN);
        assert!(table::contains(&gov.categories, category_id), E_CATEGORY_NOT_FOUND);
        let category = table::borrow_mut(&mut gov.categories, category_id);
        category.active = active;
        category.updated_at_secs = timestamp::now_seconds();
        record_category_change(gov, CATEGORY_STATUS_CHANGED, category_id, actor, active, metadata_hash);
    }

    public entry fun propose_policy_change(
        admin: &signer,
        category_id: u64,
        q0: u64,
        q1: u64,
        q2: u64,
        q3: u64,
        floor0: u64,
        floor1: u64,
        floor2: u64,
        floor3: u64,
        max_individual_weight: u64,
        evidence_hash: vector<u8>,
        reason_uri: vector<u8>,
        lifetime_secs: u64,
    ) acquires Governance {
        let quotas = four(q0, q1, q2, q3);
        let floors = four(floor0, floor1, floor2, floor3);
        assert_policy(&quotas, &floors, max_individual_weight);
        assert_hash(&evidence_hash);
        assert!(vector::length(&reason_uri) <= MAX_URI_BYTES, E_BAD_METADATA);
        assert!(lifetime_secs > 0 && lifetime_secs <= MAX_PROPOSAL_LIFETIME_SECS, E_BAD_PROPOSAL_EXPIRY);
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let proposer = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, proposer), E_NOT_ADMIN);
        assert!(table::contains(&gov.categories, category_id), E_CATEGORY_NOT_FOUND);
        check_policy_fits(table::borrow(&gov.categories, category_id), &quotas, &floors, max_individual_weight);
        let id = gov.next_policy_proposal_id;
        gov.next_policy_proposal_id = id + 1;
        let now = timestamp::now_seconds();
        table::add(&mut gov.policy_proposals, id, PolicyProposal {
            id,
            council_epoch: gov.council_epoch,
            proposer,
            category_id,
            quotas,
            floors,
            max_individual_weight,
            evidence_hash,
            reason_uri,
            approvals: vector[proposer],
            created_at_secs: now,
            expires_at_secs: now + lifetime_secs,
            status: STATUS_PENDING,
        });
        let proposal = table::borrow(&gov.policy_proposals, id);
        event::emit(PolicyChangeProposed {
            proposal_id: id,
            council_epoch: proposal.council_epoch,
            proposer,
            category_id,
            quotas: proposal.quotas,
            floors: proposal.floors,
            max_individual_weight,
            evidence_hash: proposal.evidence_hash,
            reason_uri: proposal.reason_uri,
            expires_at_secs: proposal.expires_at_secs,
        });
        if (admin_threshold_internal(&gov.admins) == 1) {
            apply_policy_proposal(gov, id, now);
        };
    }

    public entry fun approve_policy_change(admin: &signer, proposal_id: u64) acquires Governance {
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let approver = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, approver), E_NOT_ADMIN);
        assert!(table::contains(&gov.policy_proposals, proposal_id), E_PROPOSAL_NOT_FOUND);
        let now = timestamp::now_seconds();
        let proposal = table::borrow_mut(&mut gov.policy_proposals, proposal_id);
        assert!(proposal.status == STATUS_PENDING, E_PROPOSAL_NOT_PENDING);
        assert!(proposal.council_epoch == gov.council_epoch, E_STALE_COUNCIL);
        assert!(now <= proposal.expires_at_secs, E_BAD_PROPOSAL_EXPIRY);
        assert!(!is_admin_internal(&proposal.approvals, approver), E_ALREADY_APPROVED);
        vector::push_back(&mut proposal.approvals, approver);
        let approvals = vector::length(&proposal.approvals);
        let threshold = admin_threshold_internal(&gov.admins);
        event::emit(PolicyChangeApproved { proposal_id, approver, approvals, threshold });
        if (approvals >= threshold) {
            apply_policy_proposal(gov, proposal_id, now);
        };
    }

    public entry fun propose_qualification(
        admin: &signer,
        account: address,
        category_id: u64,
        level: u8,
        eligible: bool,
        evidence_hash: vector<u8>,
        manual_weight: u64,
        reason_uri: vector<u8>,
        lifetime_secs: u64,
    ) acquires Governance {
        assert!(account != @0x0, E_ZERO_ADDRESS);
        assert!(level < 4, E_BAD_LEVEL);
        assert_hash(&evidence_hash);
        assert!(vector::length(&reason_uri) <= MAX_URI_BYTES, E_BAD_METADATA);
        assert!(lifetime_secs > 0 && lifetime_secs <= MAX_PROPOSAL_LIFETIME_SECS, E_BAD_PROPOSAL_EXPIRY);
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let proposer = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, proposer), E_NOT_ADMIN);
        assert!(table::contains(&gov.categories, category_id), E_CATEGORY_NOT_FOUND);
        let category = table::borrow(&gov.categories, category_id);
        assert!(category.active, E_CATEGORY_INACTIVE);
        assert!(manual_weight <= category.max_individual_weight, E_BAD_MANUAL_WEIGHT);
        let id = gov.next_qualification_proposal_id;
        gov.next_qualification_proposal_id = id + 1;
        let now = timestamp::now_seconds();
        table::add(&mut gov.qualification_proposals, id, QualificationProposal {
            id,
            council_epoch: gov.council_epoch,
            proposer,
            account,
            category_id,
            level,
            eligible,
            evidence_hash,
            manual_weight,
            reason_uri,
            approvals: vector[proposer],
            created_at_secs: now,
            expires_at_secs: now + lifetime_secs,
            status: STATUS_PENDING,
        });
        let proposal = table::borrow(&gov.qualification_proposals, id);
        event::emit(QualificationProposed {
            proposal_id: id,
            council_epoch: proposal.council_epoch,
            proposer,
            account,
            category_id,
            level,
            eligible,
            evidence_hash: proposal.evidence_hash,
            manual_weight,
            reason_uri: proposal.reason_uri,
            expires_at_secs: proposal.expires_at_secs,
        });
        if (admin_threshold_internal(&gov.admins) == 1) {
            apply_qualification_proposal(gov, id, now);
        };
    }

    public entry fun approve_qualification(admin: &signer, proposal_id: u64) acquires Governance {
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let approver = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, approver), E_NOT_ADMIN);
        assert!(table::contains(&gov.qualification_proposals, proposal_id), E_PROPOSAL_NOT_FOUND);
        let now = timestamp::now_seconds();
        let proposal = table::borrow_mut(&mut gov.qualification_proposals, proposal_id);
        assert!(proposal.status == STATUS_PENDING, E_PROPOSAL_NOT_PENDING);
        assert!(proposal.council_epoch == gov.council_epoch, E_STALE_COUNCIL);
        assert!(now <= proposal.expires_at_secs, E_BAD_PROPOSAL_EXPIRY);
        assert!(!is_admin_internal(&proposal.approvals, approver), E_ALREADY_APPROVED);
        vector::push_back(&mut proposal.approvals, approver);
        let approvals = vector::length(&proposal.approvals);
        let threshold = admin_threshold_internal(&gov.admins);
        event::emit(QualificationApproved { proposal_id, approver, approvals, threshold });
        if (approvals >= threshold) {
            apply_qualification_proposal(gov, proposal_id, now);
        };
    }

    public entry fun create_election(
        admin: &signer,
        category_id: u64,
        metadata_hash: vector<u8>,
        metadata_uri: vector<u8>,
        starts_at_secs: u64,
        ends_at_secs: u64,
        pass_bps: u64,
        quorum_bps: u64,
        allow_revote: bool,
    ) acquires Governance {
        assert_hash(&metadata_hash);
        assert!(vector::length(&metadata_uri) <= MAX_URI_BYTES, E_BAD_METADATA);
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        let creator = signer::address_of(admin);
        assert!(is_admin_internal(&gov.admins, creator), E_NOT_ADMIN);
        assert!(table::contains(&gov.categories, category_id), E_CATEGORY_NOT_FOUND);
        let category = table::borrow(&gov.categories, category_id);
        assert!(category.active, E_CATEGORY_INACTIVE);
        let now = timestamp::now_seconds();
        let start = if (starts_at_secs == 0) { now } else { starts_at_secs };
        assert!(start >= now && ends_at_secs > start && ends_at_secs - start <= MAX_ELECTION_DURATION_SECS, E_BAD_ELECTION_WINDOW);
        let threshold = if (pass_bps == 0) { gov.default_pass_bps } else { pass_bps };
        assert!(threshold >= DEFAULT_PASS_BPS && threshold <= BPS_DENOMINATOR, E_BAD_PASS_THRESHOLD);
        let quorum = if (quorum_bps == 0) { DEFAULT_QUORUM_BPS } else { quorum_bps };
        assert!(quorum <= BPS_DENOMINATOR, E_BAD_QUORUM_BPS);
        let (targets, derived_weights, remainders, eligible_total) = build_snapshot(category);
        let quorum_weight = (((eligible_total as u128) * (quorum as u128)) / (BPS_DENOMINATOR as u128)) as u64;
        let id = gov.next_election_id;
        gov.next_election_id = id + 1;
        let membership_version = gov.membership_version;
        let policy_version = category.policy_version;
        let counts = category.counts;
        let event_targets = targets;
        let event_weights = derived_weights;
        let event_remainders = remainders;
        table::add(&mut gov.elections, id, Election {
            id,
            created_by: creator,
            category_id,
            metadata_hash,
            metadata_uri,
            membership_version,
            policy_version,
            quotas: category.quotas,
            floors: category.floors,
            max_individual_weight: category.max_individual_weight,
            counts,
            manual_counts: category.manual_counts,
            manual_sums: category.manual_sums,
            targets,
            derived_weights,
            remainders,
            eligible_total,
            pass_bps: threshold,
            quorum_bps: quorum,
            quorum_weight,
            allow_revote,
            starts_at_secs: start,
            ends_at_secs,
            status: STATUS_PENDING,
            yes_units: 0,
            no_units: 0,
            abstain_units: 0,
            unique_voters: 0,
            next_revision_id: 0,
            passed: false,
            quorum_met: false,
            finalized_at_secs: 0,
            votes: table::new(),
            revisions: table::new(),
        });
        event::emit(ElectionCreated {
            election_id: id,
            creator,
            category_id,
            membership_version,
            policy_version,
            counts,
            targets: event_targets,
            derived_weights: event_weights,
            remainders: event_remainders,
            eligible_total,
            pass_bps: threshold,
            quorum_bps: quorum,
            quorum_weight,
            starts_at_secs: start,
            ends_at_secs,
        });
    }

    public entry fun cast_vote(
        voter: &signer,
        election_id: u64,
        yes_bps: u64,
        no_bps: u64,
        abstain_bps: u64,
    ) acquires Governance {
        assert!(yes_bps <= BPS_DENOMINATOR && no_bps <= BPS_DENOMINATOR && abstain_bps <= BPS_DENOMINATOR, E_BAD_ALLOCATION);
        assert!(yes_bps + no_bps + abstain_bps == BPS_DENOMINATOR, E_BAD_ALLOCATION);
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let voter_address = signer::address_of(voter);
        let election = table::borrow_mut(&mut gov.elections, election_id);
        let now = timestamp::now_seconds();
        assert!(election.status == STATUS_PENDING, E_ELECTION_FINALIZED);
        assert!(now >= election.starts_at_secs && now < election.ends_at_secs, E_ELECTION_NOT_OPEN);
        let (found, level, eligible, _, manual_weight, _, _, confirmed_at_secs) = qualification_at_version_internal(
            &gov.qualifications,
            voter_address,
            election.category_id,
            election.membership_version,
        );
        assert!(found && eligible, E_NO_VOTING_WEIGHT);
        let base_weight = if (manual_weight > 0) {
            assert!(manual_weight <= election.max_individual_weight, E_BAD_MANUAL_WEIGHT);
            manual_weight
        } else {
            *vector::borrow(&election.derived_weights, level as u64)
        };
        assert!(base_weight > 0, E_NO_VOTING_WEIGHT);
        let (weight, multiplier_bps) = apply_degradation(
            base_weight,
            level,
            *vector::borrow(&election.floors, level as u64),
            confirmed_at_secs,
            election.starts_at_secs,
        );
        let revision;
        if (table::contains(&election.votes, voter_address)) {
            assert!(election.allow_revote, E_REVOTE_DISABLED);
            let previous = *table::borrow(&election.votes, voter_address);
            election.yes_units = election.yes_units - weighted_units(previous.weight, previous.yes_bps);
            election.no_units = election.no_units - weighted_units(previous.weight, previous.no_bps);
            election.abstain_units = election.abstain_units - weighted_units(previous.weight, previous.abstain_bps);
            revision = previous.revision + 1;
            let history_id = election.next_revision_id;
            election.next_revision_id = history_id + 1;
            table::add(&mut election.revisions, history_id, VoteRevision {
                voter: voter_address,
                revision: previous.revision,
                weight: previous.weight,
                multiplier_bps: previous.multiplier_bps,
                yes_bps: previous.yes_bps,
                no_bps: previous.no_bps,
                abstain_bps: previous.abstain_bps,
                cast_at_secs: previous.cast_at_secs,
                replaced_at_secs: now,
            });
        } else {
            election.unique_voters = election.unique_voters + 1;
            revision = 1;
        };
        election.yes_units = election.yes_units + weighted_units(weight, yes_bps);
        election.no_units = election.no_units + weighted_units(weight, no_bps);
        election.abstain_units = election.abstain_units + weighted_units(weight, abstain_bps);
        let record = VoteRecord { revision, weight, multiplier_bps, yes_bps, no_bps, abstain_bps, cast_at_secs: now };
        if (table::contains(&election.votes, voter_address)) {
            *table::borrow_mut(&mut election.votes, voter_address) = record;
        } else {
            table::add(&mut election.votes, voter_address, record);
        };
        event::emit(VoteCast { election_id, voter: voter_address, revision, weight, multiplier_bps, yes_bps, no_bps, abstain_bps });
    }

    public entry fun finalize(_caller: &signer, election_id: u64) acquires Governance {
        let gov = borrow_global_mut<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow_mut(&mut gov.elections, election_id);
        assert!(election.status == STATUS_PENDING, E_ELECTION_FINALIZED);
        let now = timestamp::now_seconds();
        assert!(now >= election.ends_at_secs, E_ELECTION_NOT_ENDED);
        let participation_units = election.yes_units + election.no_units + election.abstain_units;
        let quorum_units = (election.quorum_weight as u128) * (BPS_DENOMINATOR as u128);
        let quorum_met = participation_units >= quorum_units;
        let decisive_units = election.yes_units + election.no_units;
        let passed = quorum_met && decisive_units > 0 &&
            election.yes_units * (BPS_DENOMINATOR as u128) >= decisive_units * (election.pass_bps as u128);
        election.status = STATUS_FINALIZED;
        election.quorum_met = quorum_met;
        election.passed = passed;
        election.finalized_at_secs = now;
        event::emit(ElectionFinalized {
            election_id,
            quorum_met,
            passed,
            yes_units: election.yes_units,
            no_units: election.no_units,
            abstain_units: election.abstain_units,
            finalized_at_secs: now,
        });
    }

    #[view]
    public fun is_initialized(): bool { exists<Governance>(@aptos_voting) }

    #[view]
    public fun weight_scale(): u64 { WEIGHT_SCALE }

    #[view]
    public fun creator(): address acquires Governance {
        assert!(exists<Governance>(@aptos_voting), E_NOT_INITIALIZED);
        borrow_global<Governance>(@aptos_voting).creator
    }

    #[view]
    public fun admins(): vector<address> acquires Governance {
        borrow_global<Governance>(@aptos_voting).admins
    }

    #[view]
    public fun admin_threshold(): u64 acquires Governance {
        admin_threshold_internal(&borrow_global<Governance>(@aptos_voting).admins)
    }

    #[view]
    public fun is_admin(account: address): bool acquires Governance {
        is_admin_internal(&borrow_global<Governance>(@aptos_voting).admins, account)
    }

    #[view]
    public fun versions(): (u64, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        (gov.council_epoch, gov.policy_version, gov.membership_version)
    }

    #[view]
    public fun counters(): (u64, u64, u64, u64, u64, u64, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        (
            gov.next_category_id,
            gov.next_admin_change_id,
            gov.next_category_change_id,
            gov.next_policy_proposal_id,
            gov.next_policy_change_id,
            gov.next_qualification_proposal_id,
            gov.next_qualification_change_id,
            gov.next_election_id,
        )
    }

    #[view]
    public fun admin_change(change_id: u64): (u8, address, address, u64, u64, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.admin_changes, change_id), E_HISTORY_NOT_FOUND);
        let change = table::borrow(&gov.admin_changes, change_id);
        (change.action, change.admin, change.actor, change.council_epoch, change.admin_count, change.threshold, change.changed_at_secs)
    }

    #[view]
    public fun category(category_id: u64): (vector<u8>, vector<u8>, bool, u64, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.categories, category_id), E_CATEGORY_NOT_FOUND);
        let category = table::borrow(&gov.categories, category_id);
        (category.name, category.metadata_uri, category.active, category.policy_version, category.created_at_secs, category.updated_at_secs)
    }

    #[view]
    public fun category_policy(category_id: u64): (vector<u64>, vector<u64>, u64, vector<u64>, vector<u64>, vector<u64>) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.categories, category_id), E_CATEGORY_NOT_FOUND);
        let category = table::borrow(&gov.categories, category_id);
        (category.quotas, category.floors, category.max_individual_weight, category.counts, category.manual_counts, category.manual_sums)
    }

    #[view]
    public fun category_change(change_id: u64): (u8, u64, address, bool, vector<u8>, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.category_changes, change_id), E_HISTORY_NOT_FOUND);
        let change = table::borrow(&gov.category_changes, change_id);
        (change.action, change.category_id, change.actor, change.active, change.metadata_hash, change.changed_at_secs)
    }

    #[view]
    public fun current_qualification(account: address, category_id: u64): (bool, u8, bool, vector<u8>, u64, u64, u64, u64) acquires Governance {
        qualification_at_version_internal(
            &borrow_global<Governance>(@aptos_voting).qualifications,
            account,
            category_id,
            18_446_744_073_709_551_615,
        )
    }

    #[view]
    public fun qualification_at_version(account: address, category_id: u64, membership_version: u64): (bool, u8, bool, vector<u8>, u64, u64, u64, u64) acquires Governance {
        qualification_at_version_internal(
            &borrow_global<Governance>(@aptos_voting).qualifications,
            account,
            category_id,
            membership_version,
        )
    }

    #[view]
    public fun policy_proposal(proposal_id: u64): (u64, address, u64, vector<u64>, vector<u64>, u64, vector<u8>, vector<u8>, vector<address>, u64, u64, u8) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.policy_proposals, proposal_id), E_PROPOSAL_NOT_FOUND);
        let proposal = table::borrow(&gov.policy_proposals, proposal_id);
        (proposal.council_epoch, proposal.proposer, proposal.category_id, proposal.quotas, proposal.floors, proposal.max_individual_weight, proposal.evidence_hash, proposal.reason_uri, proposal.approvals, proposal.created_at_secs, proposal.expires_at_secs, proposal.status)
    }

    #[view]
    public fun policy_change(change_id: u64): (u64, u64, u64, vector<u64>, vector<u64>, u64, vector<u8>, vector<u8>, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.policy_changes, change_id), E_HISTORY_NOT_FOUND);
        let change = table::borrow(&gov.policy_changes, change_id);
        (change.proposal_id, change.category_id, change.policy_version, change.quotas, change.floors, change.max_individual_weight, change.evidence_hash, change.reason_uri, change.changed_at_secs)
    }

    #[view]
    public fun qualification_proposal(proposal_id: u64): (u64, address, address, u64, u8, bool, vector<u8>, u64, vector<u8>, vector<address>, u64, u64, u8) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.qualification_proposals, proposal_id), E_PROPOSAL_NOT_FOUND);
        let proposal = table::borrow(&gov.qualification_proposals, proposal_id);
        (proposal.council_epoch, proposal.proposer, proposal.account, proposal.category_id, proposal.level, proposal.eligible, proposal.evidence_hash, proposal.manual_weight, proposal.reason_uri, proposal.approvals, proposal.created_at_secs, proposal.expires_at_secs, proposal.status)
    }

    #[view]
    public fun qualification_change(change_id: u64): (u64, address, u64, u8, bool, u64, u8, bool, u64, u64, vector<u8>, vector<u8>, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.qualification_changes, change_id), E_HISTORY_NOT_FOUND);
        let change = table::borrow(&gov.qualification_changes, change_id);
        (change.proposal_id, change.account, change.category_id, change.old_level, change.old_eligible, change.old_manual_weight, change.new_level, change.new_eligible, change.new_manual_weight, change.membership_version, change.evidence_hash, change.reason_uri, change.changed_at_secs)
    }

    #[view]
    public fun election(election_id: u64): (address, u64, vector<u8>, vector<u8>, u64, u64, u64, u64, u64, bool, u64, u64, u8, u64, bool, bool, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        (election.created_by, election.category_id, election.metadata_hash, election.metadata_uri, election.membership_version, election.policy_version, election.pass_bps, election.quorum_bps, election.quorum_weight, election.allow_revote, election.starts_at_secs, election.ends_at_secs, election.status, election.eligible_total, election.quorum_met, election.passed, election.finalized_at_secs)
    }

    #[view]
    public fun election_snapshot(election_id: u64): (vector<u64>, vector<u64>, u64, vector<u64>, vector<u64>, vector<u64>, vector<u64>, vector<u64>, vector<u64>, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        (election.quotas, election.floors, election.max_individual_weight, election.counts, election.manual_counts, election.manual_sums, election.targets, election.derived_weights, election.remainders, election.eligible_total)
    }

    #[view]
    public fun election_tallies(election_id: u64): (u128, u128, u128, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        (election.yes_units, election.no_units, election.abstain_units, election.unique_voters)
    }

    #[view]
    public fun election_result(election_id: u64): (bool, bool, bool) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        (election.status == STATUS_FINALIZED, election.quorum_met, election.passed)
    }

    #[view]
    public fun vote_of(election_id: u64, voter: address): (bool, u64, u64, u64, u64, u64, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        if (!table::contains(&election.votes, voter)) {
            return (false, 0, 0, 0, 0, 0, 0, 0)
        };
        let vote = table::borrow(&election.votes, voter);
        (true, vote.revision, vote.weight, vote.multiplier_bps, vote.yes_bps, vote.no_bps, vote.abstain_bps, vote.cast_at_secs)
    }

    #[view]
    public fun vote_revision(election_id: u64, history_id: u64): (address, u64, u64, u64, u64, u64, u64, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        assert!(table::contains(&election.revisions, history_id), E_HISTORY_NOT_FOUND);
        let revision = table::borrow(&election.revisions, history_id);
        (revision.voter, revision.revision, revision.weight, revision.multiplier_bps, revision.yes_bps, revision.no_bps, revision.abstain_bps, revision.cast_at_secs, revision.replaced_at_secs)
    }

    #[view]
    /// Preview of the effective ballot weight an account would carry in an
    /// election right now: (eligible, weight, multiplier_bps). Lets any voter
    /// or auditor verify the degradation math before and after casting.
    public fun voting_weight_preview(election_id: u64, voter: address): (bool, u64, u64) acquires Governance {
        let gov = borrow_global<Governance>(@aptos_voting);
        assert!(table::contains(&gov.elections, election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&gov.elections, election_id);
        let (found, level, eligible, _, manual_weight, _, _, confirmed_at_secs) = qualification_at_version_internal(
            &gov.qualifications,
            voter,
            election.category_id,
            election.membership_version,
        );
        if (!found || !eligible) {
            return (false, 0, 0)
        };
        let base_weight = if (manual_weight > 0) {
            manual_weight
        } else {
            *vector::borrow(&election.derived_weights, level as u64)
        };
        if (base_weight == 0 || base_weight > election.max_individual_weight) {
            return (false, 0, 0)
        };
        let (weight, multiplier_bps) = apply_degradation(
            base_weight,
            level,
            *vector::borrow(&election.floors, level as u64),
            confirmed_at_secs,
            election.starts_at_secs,
        );
        (true, weight, multiplier_bps)
    }

    #[view]
    /// Degradation parameters: (period_secs, keep_bps_per_period, max_periods).
    public fun degradation_params(): (u64, u64, u64) {
        (DEGRADE_PERIOD_SECS, DEGRADE_KEEP_BPS, MAX_DEGRADE_PERIODS)
    }

    fun record_admin_change(gov: &mut Governance, action: u8, admin: address, actor: address) {
        let id = gov.next_admin_change_id;
        gov.next_admin_change_id = id + 1;
        let admin_count = vector::length(&gov.admins);
        let threshold = admin_threshold_internal(&gov.admins);
        let now = timestamp::now_seconds();
        table::add(&mut gov.admin_changes, id, AdminChange { id, action, admin, actor, council_epoch: gov.council_epoch, admin_count, threshold, changed_at_secs: now });
        event::emit(AdminChanged { change_id: id, action, admin, actor, council_epoch: gov.council_epoch, admin_count, threshold });
    }

    fun record_category_change(gov: &mut Governance, action: u8, category_id: u64, actor: address, active: bool, metadata_hash: vector<u8>) {
        let id = gov.next_category_change_id;
        gov.next_category_change_id = id + 1;
        let now = timestamp::now_seconds();
        table::add(&mut gov.category_changes, id, CategoryChange { id, action, category_id, actor, active, metadata_hash, changed_at_secs: now });
        let change = table::borrow(&gov.category_changes, id);
        event::emit(CategoryChanged { change_id: id, action, category_id, actor, active, metadata_hash: change.metadata_hash });
    }

    fun apply_policy_proposal(gov: &mut Governance, proposal_id: u64, now: u64) {
        let proposal = table::borrow_mut(&mut gov.policy_proposals, proposal_id);
        assert!(proposal.status == STATUS_PENDING, E_PROPOSAL_NOT_PENDING);
        assert!(proposal.council_epoch == gov.council_epoch, E_STALE_COUNCIL);
        assert!(now <= proposal.expires_at_secs, E_BAD_PROPOSAL_EXPIRY);
        proposal.status = STATUS_EXECUTED;
        let category_id = proposal.category_id;
        let quotas = proposal.quotas;
        let floors = proposal.floors;
        let max_individual_weight = proposal.max_individual_weight;
        let evidence_hash = proposal.evidence_hash;
        let reason_uri = proposal.reason_uri;
        gov.policy_version = gov.policy_version + 1;
        let policy_version = gov.policy_version;
        let category = table::borrow_mut(&mut gov.categories, category_id);
        // Without an account index, lowering the cap cannot prove that every existing
        // manual override still fits. Keep cap changes monotonic in this MVP.
        assert!(max_individual_weight >= category.max_individual_weight, E_BAD_POLICY);
        category.policy_version = policy_version;
        category.quotas = quotas;
        category.floors = floors;
        category.max_individual_weight = max_individual_weight;
        category.updated_at_secs = now;
        check_policy_fits(category, &quotas, &floors, max_individual_weight);
        let id = gov.next_policy_change_id;
        gov.next_policy_change_id = id + 1;
        table::add(&mut gov.policy_changes, id, PolicyChange { id, proposal_id, category_id, policy_version, quotas, floors, max_individual_weight, evidence_hash, reason_uri, changed_at_secs: now });
        event::emit(PolicyChanged { change_id: id, proposal_id, category_id, policy_version, quotas, floors, max_individual_weight, evidence_hash, reason_uri });
    }

    fun apply_qualification_proposal(gov: &mut Governance, proposal_id: u64, now: u64) {
        let proposal = table::borrow_mut(&mut gov.qualification_proposals, proposal_id);
        assert!(proposal.status == STATUS_PENDING, E_PROPOSAL_NOT_PENDING);
        assert!(proposal.council_epoch == gov.council_epoch, E_STALE_COUNCIL);
        assert!(now <= proposal.expires_at_secs, E_BAD_PROPOSAL_EXPIRY);
        let category = table::borrow(&gov.categories, proposal.category_id);
        assert!(proposal.manual_weight <= category.max_individual_weight, E_BAD_MANUAL_WEIGHT);
        proposal.status = STATUS_EXECUTED;
        let account = proposal.account;
        let category_id = proposal.category_id;
        let level = proposal.level;
        let eligible = proposal.eligible;
        let manual_weight = proposal.manual_weight;
        let evidence_hash = proposal.evidence_hash;
        let reason_uri = proposal.reason_uri;
        let (found, old_level, old_eligible, _, old_manual_weight, _, _, _) = qualification_at_version_internal(
            &gov.qualifications,
            account,
            category_id,
            18_446_744_073_709_551_615,
        );
        let category = table::borrow_mut(&mut gov.categories, category_id);
        if (found && old_eligible) {
            subtract_bucket(category, old_level, old_manual_weight);
        };
        if (eligible) {
            add_bucket(category, level, manual_weight);
        };
        gov.membership_version = gov.membership_version + 1;
        let membership_version = gov.membership_version;
        let id = gov.next_qualification_change_id;
        gov.next_qualification_change_id = id + 1;
        let revision = QualificationRevision { membership_version, level, eligible, evidence_hash, manual_weight, change_id: id, changed_at_secs: now };
        if (!table::contains(&gov.qualifications, account)) {
            table::add(&mut gov.qualifications, account, AccountQualifications { by_category: table::new() });
        };
        let account_qualifications = table::borrow_mut(&mut gov.qualifications, account);
        if (!table::contains(&account_qualifications.by_category, category_id)) {
            table::add(&mut account_qualifications.by_category, category_id, vector::empty());
        };
        vector::push_back(table::borrow_mut(&mut account_qualifications.by_category, category_id), revision);
        table::add(&mut gov.qualification_changes, id, QualificationChange {
            id,
            proposal_id,
            account,
            category_id,
            old_level,
            old_eligible,
            old_manual_weight,
            new_level: level,
            new_eligible: eligible,
            new_manual_weight: manual_weight,
            membership_version,
            evidence_hash,
            reason_uri,
            changed_at_secs: now,
        });
        event::emit(QualificationChanged {
            change_id: id,
            proposal_id,
            account,
            category_id,
            old_level,
            old_eligible,
            old_manual_weight,
            new_level: level,
            new_eligible: eligible,
            new_manual_weight: manual_weight,
            membership_version,
            evidence_hash,
            reason_uri,
        });
    }

    fun add_bucket(category: &mut Category, level: u8, manual_weight: u64) {
        let index = level as u64;
        *vector::borrow_mut(&mut category.counts, index) = *vector::borrow(&category.counts, index) + 1;
        if (manual_weight > 0) {
            *vector::borrow_mut(&mut category.manual_counts, index) = *vector::borrow(&category.manual_counts, index) + 1;
            *vector::borrow_mut(&mut category.manual_sums, index) = *vector::borrow(&category.manual_sums, index) + manual_weight;
        };
    }

    fun subtract_bucket(category: &mut Category, level: u8, manual_weight: u64) {
        let index = level as u64;
        *vector::borrow_mut(&mut category.counts, index) = *vector::borrow(&category.counts, index) - 1;
        if (manual_weight > 0) {
            *vector::borrow_mut(&mut category.manual_counts, index) = *vector::borrow(&category.manual_counts, index) - 1;
            *vector::borrow_mut(&mut category.manual_sums, index) = *vector::borrow(&category.manual_sums, index) - manual_weight;
        };
    }

    fun build_snapshot(category: &Category): (vector<u64>, vector<u64>, vector<u64>, u64) {
        let n0 = *vector::borrow(&category.counts, 0);
        assert!(n0 > 0, E_NO_LEVEL_ZERO_MEMBERS);
        let q0 = *vector::borrow(&category.quotas, 0);
        let targets = vector::empty<u64>();
        let derived_weights = vector::empty<u64>();
        let remainders = vector::empty<u64>();
        let eligible_total = 0;
        let index = 0;
        while (index < 4) {
            let quota = *vector::borrow(&category.quotas, index);
            let target = (((n0 as u128) * (WEIGHT_SCALE as u128) * (quota as u128)) / (q0 as u128)) as u64;
            let count = *vector::borrow(&category.counts, index);
            let manual_count = *vector::borrow(&category.manual_counts, index);
            let manual_total = *vector::borrow(&category.manual_sums, index);
            assert!(manual_count <= count && manual_total <= target, E_MANUAL_TOTAL_EXCEEDS_TARGET);
            let remaining_count = count - manual_count;
            let available = target - manual_total;
            let derived = if (remaining_count == 0) { 0 } else { available / remaining_count };
            let remainder = if (remaining_count == 0) { available } else { available % remaining_count };
            if (remaining_count > 0) {
                // The floor is a guarantee, not a rejection: when the quota
                // pool spreads too thin, every member of the level is lifted
                // to the floor. The overshoot above the target is public and
                // recomputable from the snapshot (counts, quotas, floors).
                let floor = *vector::borrow(&category.floors, index);
                if (derived < floor) {
                    derived = floor;
                    remainder = 0;
                };
                assert!(derived <= category.max_individual_weight, E_DERIVED_WEIGHT_ABOVE_CAP);
            };
            vector::push_back(&mut targets, target);
            vector::push_back(&mut derived_weights, derived);
            vector::push_back(&mut remainders, remainder);
            eligible_total = eligible_total + manual_total + derived * remaining_count;
            index = index + 1;
        };
        (targets, derived_weights, remainders, eligible_total)
    }

    /// Validates that a (proposed or just-applied) policy is consistent with
    /// the category's current membership: manual overrides fit inside the
    /// level targets and the floor-lifted derived weight stays under the cap.
    /// No-op while the category has no level-zero members: the same check is
    /// re-run by `build_snapshot` at every election creation.
    fun check_policy_fits(category: &Category, quotas: &vector<u64>, floors: &vector<u64>, max_individual_weight: u64) {
        let n0 = *vector::borrow(&category.counts, 0);
        if (n0 == 0) {
            return
        };
        let q0 = *vector::borrow(quotas, 0);
        let index = 0;
        while (index < 4) {
            let quota = *vector::borrow(quotas, index);
            let target = (((n0 as u128) * (WEIGHT_SCALE as u128) * (quota as u128)) / (q0 as u128)) as u64;
            let count = *vector::borrow(&category.counts, index);
            let manual_count = *vector::borrow(&category.manual_counts, index);
            let manual_total = *vector::borrow(&category.manual_sums, index);
            assert!(manual_count <= count && manual_total <= target, E_MANUAL_TOTAL_EXCEEDS_TARGET);
            let remaining_count = count - manual_count;
            if (remaining_count > 0) {
                let derived = (target - manual_total) / remaining_count;
                let floor = *vector::borrow(floors, index);
                if (derived < floor) {
                    derived = floor;
                };
                assert!(derived <= max_individual_weight, E_DERIVED_WEIGHT_ABOVE_CAP);
            };
            index = index + 1;
        };
    }

    fun qualification_at_version_internal(
        qualifications: &Table<address, AccountQualifications>,
        account: address,
        category_id: u64,
        membership_version: u64,
    ): (bool, u8, bool, vector<u8>, u64, u64, u64, u64) {
        if (!table::contains(qualifications, account)) {
            return (false, 0, false, vector::empty(), 0, 0, 0, 0)
        };
        let account_qualifications = table::borrow(qualifications, account);
        if (!table::contains(&account_qualifications.by_category, category_id)) {
            return (false, 0, false, vector::empty(), 0, 0, 0, 0)
        };
        let revisions = table::borrow(&account_qualifications.by_category, category_id);
        let length = vector::length(revisions);
        while (length > 0) {
            length = length - 1;
            let revision = vector::borrow(revisions, length);
            if (revision.membership_version <= membership_version) {
                return (true, revision.level, revision.eligible, revision.evidence_hash, revision.manual_weight, revision.membership_version, revision.change_id, revision.changed_at_secs)
            };
        };
        (false, 0, false, vector::empty(), 0, 0, 0, 0)
    }

    fun assert_policy(quotas: &vector<u64>, floors: &vector<u64>, max_individual_weight: u64) {
        assert!(vector::length(quotas) == 4 && vector::length(floors) == 4, E_BAD_POLICY);
        assert!(*vector::borrow(quotas, 0) > 0, E_BAD_POLICY);
        let quota_sum = 0;
        let index = 0;
        while (index < 4) {
            quota_sum = quota_sum + *vector::borrow(quotas, index);
            assert!(*vector::borrow(floors, index) <= max_individual_weight, E_BAD_POLICY);
            index = index + 1;
        };
        assert!(quota_sum == BPS_DENOMINATOR && max_individual_weight > 0, E_BAD_POLICY);
    }

    /// Expert weight decays by 15% per elapsed half-year since the last
    /// qualification confirmation, but never falls below the guaranteed
    /// lower bound: max(level floor, base citizen weight 1.0), capped by the
    /// snapshot weight itself. Level 0 never degrades. Time is measured up to
    /// the election start, so a ballot's weight does not depend on when the
    /// vote lands inside the voting window.
    fun apply_degradation(
        base_weight: u64,
        level: u8,
        floor: u64,
        confirmed_at_secs: u64,
        reference_secs: u64,
    ): (u64, u64) {
        if (level == 0) {
            return (base_weight, BPS_DENOMINATOR)
        };
        let multiplier_bps = degrade_multiplier_bps(confirmed_at_secs, reference_secs);
        let degraded = (((base_weight as u128) * (multiplier_bps as u128)) / (BPS_DENOMINATOR as u128)) as u64;
        let lower = if (floor > WEIGHT_SCALE) { floor } else { WEIGHT_SCALE };
        if (lower > base_weight) {
            lower = base_weight;
        };
        if (degraded < lower) {
            (lower, multiplier_bps)
        } else {
            (degraded, multiplier_bps)
        }
    }

    fun degrade_multiplier_bps(confirmed_at_secs: u64, reference_secs: u64): u64 {
        if (reference_secs <= confirmed_at_secs) {
            return BPS_DENOMINATOR
        };
        let periods = (reference_secs - confirmed_at_secs) / DEGRADE_PERIOD_SECS;
        if (periods > MAX_DEGRADE_PERIODS) {
            periods = MAX_DEGRADE_PERIODS;
        };
        let multiplier = (BPS_DENOMINATOR as u128);
        let index = 0;
        while (index < periods) {
            multiplier = multiplier * (DEGRADE_KEEP_BPS as u128) / (BPS_DENOMINATOR as u128);
            index = index + 1;
        };
        (multiplier as u64)
    }

    fun four(a: u64, b: u64, c: u64, d: u64): vector<u64> {
        vector[a, b, c, d]
    }

    fun weighted_units(weight: u64, allocation_bps: u64): u128 {
        (weight as u128) * (allocation_bps as u128)
    }

    fun admin_threshold_internal(admins: &vector<address>): u64 {
        vector::length(admins) / 2 + 1
    }

    fun is_admin_internal(admins: &vector<address>, account: address): bool {
        let (found, _) = find_admin(admins, account);
        found
    }

    fun find_admin(admins: &vector<address>, account: address): (bool, u64) {
        let index = 0;
        let length = vector::length(admins);
        while (index < length) {
            if (*vector::borrow(admins, index) == account) {
                return (true, index)
            };
            index = index + 1;
        };
        (false, 0)
    }

    fun assert_hash(hash: &vector<u8>) {
        assert!(vector::length(hash) == 32, E_BAD_METADATA);
    }

    fun assert_hash_or_empty(hash: &vector<u8>) {
        let length = vector::length(hash);
        assert!(length == 0 || length == 32, E_BAD_METADATA);
    }
}
