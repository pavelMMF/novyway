module aptos_voting::admin_election {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use aptos_voting::weighted_voting;

    const BPS_DENOMINATOR: u64 = 10_000;
    const MODE_EQUAL_WALLET: u8 = 0;
    const MODE_EXPERT_CATEGORY: u8 = 1;
    const CHOICE_YES: u8 = 1;
    const CHOICE_NO: u8 = 2;
    const CHOICE_ABSTAIN: u8 = 3;
    const STATUS_OPEN: u8 = 0;
    const STATUS_FINALIZED: u8 = 1;
    const STATUS_EXECUTED: u8 = 2;
    const NO_BALLOT_ID: u64 = 18_446_744_073_709_551_615;
    const MAX_URI_BYTES: u64 = 1_024;
    const MAX_ELECTION_DURATION_SECS: u64 = 31_536_000;

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_NOT_CREATOR: u64 = 3;
    const E_ZERO_ADDRESS: u64 = 4;
    const E_ALREADY_ADMIN: u64 = 5;
    const E_BAD_MODE: u64 = 6;
    const E_BAD_METADATA: u64 = 7;
    const E_BAD_WINDOW: u64 = 8;
    const E_BAD_THRESHOLD: u64 = 9;
    const E_VOTER_EXISTS: u64 = 10;
    const E_VOTER_NOT_FOUND: u64 = 11;
    const E_ELECTION_NOT_FOUND: u64 = 12;
    const E_WRONG_MODE: u64 = 13;
    const E_ELECTION_NOT_OPEN: u64 = 14;
    const E_NOT_ELIGIBLE: u64 = 15;
    const E_BAD_CHOICE: u64 = 16;
    const E_ALREADY_VOTED: u64 = 17;
    const E_NOT_ENDED: u64 = 18;
    const E_ALREADY_FINALIZED: u64 = 19;
    const E_NOT_PASSED: u64 = 20;

    struct EligibilityWindow has copy, drop, store {
        joined_version: u64,
        left_version: u64,
    }

    struct VoterRegistration has store {
        windows: vector<EligibilityWindow>,
    }

    struct AdminElection has store {
        id: u64,
        candidate: address,
        mode: u8,
        category_id: u64,
        ballot_id: u64,
        metadata_hash: vector<u8>,
        metadata_uri: vector<u8>,
        voter_registry_version: u64,
        eligible_voters: u64,
        pass_bps: u64,
        quorum_bps: u64,
        allow_revote: bool,
        starts_at_secs: u64,
        ends_at_secs: u64,
        status: u8,
        yes_votes: u64,
        no_votes: u64,
        abstain_votes: u64,
        unique_voters: u64,
        quorum_met: bool,
        passed: bool,
        finalized_at_secs: u64,
        executed_at_secs: u64,
        votes: Table<address, u8>,
    }

    struct Registry has key {
        next_election_id: u64,
        voter_registry_version: u64,
        active_voter_count: u64,
        voters: Table<address, VoterRegistration>,
        elections: Table<u64, AdminElection>,
    }

    #[event]
    struct VoterEligibilityChanged has drop, store {
        voter: address,
        eligible: bool,
        registry_version: u64,
        active_voter_count: u64,
        actor: address,
    }

    #[event]
    struct AdminElectionCreated has drop, store {
        admin_election_id: u64,
        candidate: address,
        mode: u8,
        category_id: u64,
        ballot_id: u64,
        voter_registry_version: u64,
        eligible_voters: u64,
        pass_bps: u64,
        quorum_bps: u64,
        starts_at_secs: u64,
        ends_at_secs: u64,
        creator: address,
    }

    #[event]
    struct EqualVoteCast has drop, store {
        admin_election_id: u64,
        voter: address,
        choice: u8,
        replaced_choice: u8,
    }

    #[event]
    struct AdminElectionFinalized has drop, store {
        admin_election_id: u64,
        quorum_met: bool,
        passed: bool,
        yes_votes: u128,
        no_votes: u128,
        abstain_votes: u128,
        finalized_at_secs: u64,
    }

    #[event]
    struct ElectedAdminAdded has drop, store {
        admin_election_id: u64,
        candidate: address,
        executed_by: address,
        executed_at_secs: u64,
    }

    public entry fun initialize(creator: &signer) {
        assert_creator(creator);
        assert!(!exists<Registry>(@aptos_voting), E_ALREADY_INITIALIZED);
        move_to(creator, Registry {
            next_election_id: 0,
            voter_registry_version: 0,
            active_voter_count: 0,
            voters: table::new(),
            elections: table::new(),
        });
    }

    public entry fun register_equal_voter(creator: &signer, voter: address) acquires Registry {
        assert_creator(creator);
        assert!(voter != @0x0, E_ZERO_ADDRESS);
        let registry = borrow_global_mut<Registry>(@aptos_voting);
        assert!(!is_currently_eligible_internal(&registry.voters, voter), E_VOTER_EXISTS);
        registry.voter_registry_version = registry.voter_registry_version + 1;
        let version = registry.voter_registry_version;
        if (table::contains(&registry.voters, voter)) {
            let registration = table::borrow_mut(&mut registry.voters, voter);
            vector::push_back(&mut registration.windows, EligibilityWindow { joined_version: version, left_version: 0 });
        } else {
            table::add(&mut registry.voters, voter, VoterRegistration {
                windows: vector[EligibilityWindow { joined_version: version, left_version: 0 }],
            });
        };
        registry.active_voter_count = registry.active_voter_count + 1;
        event::emit(VoterEligibilityChanged {
            voter,
            eligible: true,
            registry_version: version,
            active_voter_count: registry.active_voter_count,
            actor: signer::address_of(creator),
        });
    }

    public entry fun unregister_equal_voter(creator: &signer, voter: address) acquires Registry {
        assert_creator(creator);
        let registry = borrow_global_mut<Registry>(@aptos_voting);
        assert!(is_currently_eligible_internal(&registry.voters, voter), E_VOTER_NOT_FOUND);
        registry.voter_registry_version = registry.voter_registry_version + 1;
        let version = registry.voter_registry_version;
        let registration = table::borrow_mut(&mut registry.voters, voter);
        let last = vector::length(&registration.windows) - 1;
        vector::borrow_mut(&mut registration.windows, last).left_version = version;
        registry.active_voter_count = registry.active_voter_count - 1;
        event::emit(VoterEligibilityChanged {
            voter,
            eligible: false,
            registry_version: version,
            active_voter_count: registry.active_voter_count,
            actor: signer::address_of(creator),
        });
    }

    public entry fun create_election(
        creator: &signer,
        candidate: address,
        mode: u8,
        category_id: u64,
        metadata_hash: vector<u8>,
        metadata_uri: vector<u8>,
        starts_at_secs: u64,
        ends_at_secs: u64,
        pass_bps: u64,
        quorum_bps: u64,
        allow_revote: bool,
    ) acquires Registry {
        assert_creator(creator);
        assert!(candidate != @0x0, E_ZERO_ADDRESS);
        assert!(!weighted_voting::is_admin(candidate), E_ALREADY_ADMIN);
        assert!(mode == MODE_EQUAL_WALLET || mode == MODE_EXPERT_CATEGORY, E_BAD_MODE);
        assert!(vector::length(&metadata_hash) == 32 && vector::length(&metadata_uri) <= MAX_URI_BYTES, E_BAD_METADATA);
        assert!(pass_bps >= 5_000 && pass_bps <= BPS_DENOMINATOR && quorum_bps <= BPS_DENOMINATOR, E_BAD_THRESHOLD);
        let now = timestamp::now_seconds();
        let start = if (starts_at_secs == 0) { now } else { starts_at_secs };
        assert!(start >= now && ends_at_secs > start && ends_at_secs - start <= MAX_ELECTION_DURATION_SECS, E_BAD_WINDOW);

        let ballot_id = NO_BALLOT_ID;
        if (mode == MODE_EXPERT_CATEGORY) {
            let (_, _, _, _, _, _, _, next_ballot_id) = weighted_voting::counters();
            ballot_id = next_ballot_id;
            weighted_voting::create_election(
                creator,
                category_id,
                metadata_hash,
                metadata_uri,
                start,
                ends_at_secs,
                pass_bps,
                quorum_bps,
                allow_revote,
            );
        };

        let registry = borrow_global_mut<Registry>(@aptos_voting);
        let id = registry.next_election_id;
        registry.next_election_id = id + 1;
        let snapshot_version = registry.voter_registry_version;
        let eligible_voters = if (mode == MODE_EQUAL_WALLET) { registry.active_voter_count } else { 0 };
        table::add(&mut registry.elections, id, AdminElection {
            id,
            candidate,
            mode,
            category_id,
            ballot_id,
            metadata_hash,
            metadata_uri,
            voter_registry_version: snapshot_version,
            eligible_voters,
            pass_bps,
            quorum_bps,
            allow_revote,
            starts_at_secs: start,
            ends_at_secs,
            status: STATUS_OPEN,
            yes_votes: 0,
            no_votes: 0,
            abstain_votes: 0,
            unique_voters: 0,
            quorum_met: false,
            passed: false,
            finalized_at_secs: 0,
            executed_at_secs: 0,
            votes: table::new(),
        });
        event::emit(AdminElectionCreated {
            admin_election_id: id,
            candidate,
            mode,
            category_id,
            ballot_id,
            voter_registry_version: snapshot_version,
            eligible_voters,
            pass_bps,
            quorum_bps,
            starts_at_secs: start,
            ends_at_secs,
            creator: signer::address_of(creator),
        });
    }

    public entry fun cast_equal_vote(voter: &signer, admin_election_id: u64, choice: u8) acquires Registry {
        assert!(choice == CHOICE_YES || choice == CHOICE_NO || choice == CHOICE_ABSTAIN, E_BAD_CHOICE);
        let registry = borrow_global_mut<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let voter_address = signer::address_of(voter);
        let election = table::borrow_mut(&mut registry.elections, admin_election_id);
        assert!(election.mode == MODE_EQUAL_WALLET, E_WRONG_MODE);
        let now = timestamp::now_seconds();
        assert!(election.status == STATUS_OPEN && now >= election.starts_at_secs && now < election.ends_at_secs, E_ELECTION_NOT_OPEN);
        assert!(is_eligible_at_internal(&registry.voters, voter_address, election.voter_registry_version), E_NOT_ELIGIBLE);
        let replaced_choice = 0;
        if (table::contains(&election.votes, voter_address)) {
            assert!(election.allow_revote, E_ALREADY_VOTED);
            replaced_choice = *table::borrow(&election.votes, voter_address);
            subtract_choice(election, replaced_choice);
            *table::borrow_mut(&mut election.votes, voter_address) = choice;
        } else {
            table::add(&mut election.votes, voter_address, choice);
            election.unique_voters = election.unique_voters + 1;
        };
        add_choice(election, choice);
        event::emit(EqualVoteCast { admin_election_id, voter: voter_address, choice, replaced_choice });
    }

    public entry fun cast_expert_vote(
        voter: &signer,
        admin_election_id: u64,
        yes_bps: u64,
        no_bps: u64,
        abstain_bps: u64,
    ) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&registry.elections, admin_election_id);
        assert!(election.mode == MODE_EXPERT_CATEGORY, E_WRONG_MODE);
        let ballot_id = election.ballot_id;
        weighted_voting::cast_vote(voter, ballot_id, yes_bps, no_bps, abstain_bps);
    }

    public entry fun finalize(caller: &signer, admin_election_id: u64) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&registry.elections, admin_election_id);
        assert!(election.status == STATUS_OPEN, E_ALREADY_FINALIZED);
        assert!(timestamp::now_seconds() >= election.ends_at_secs, E_NOT_ENDED);
        let mode = election.mode;
        let ballot_id = election.ballot_id;

        if (mode == MODE_EXPERT_CATEGORY) {
            weighted_voting::finalize(caller, ballot_id);
        };

        let registry = borrow_global_mut<Registry>(@aptos_voting);
        let election = table::borrow_mut(&mut registry.elections, admin_election_id);
        let quorum_met;
        let passed;
        let yes_votes;
        let no_votes;
        let abstain_votes;
        if (mode == MODE_EXPERT_CATEGORY) {
            let (_, expert_quorum_met, expert_passed) = weighted_voting::election_result(ballot_id);
            let (yes_units, no_units, abstain_units, _) = weighted_voting::election_tallies(ballot_id);
            quorum_met = expert_quorum_met;
            passed = expert_passed;
            yes_votes = yes_units;
            no_votes = no_units;
            abstain_votes = abstain_units;
        } else {
            let participation = election.yes_votes + election.no_votes + election.abstain_votes;
            quorum_met = (participation as u128) * (BPS_DENOMINATOR as u128) >=
                (election.eligible_voters as u128) * (election.quorum_bps as u128);
            let decisive = election.yes_votes + election.no_votes;
            passed = quorum_met && decisive > 0 &&
                (election.yes_votes as u128) * (BPS_DENOMINATOR as u128) >=
                (decisive as u128) * (election.pass_bps as u128);
            yes_votes = election.yes_votes as u128;
            no_votes = election.no_votes as u128;
            abstain_votes = election.abstain_votes as u128;
        };
        let now = timestamp::now_seconds();
        election.status = STATUS_FINALIZED;
        election.quorum_met = quorum_met;
        election.passed = passed;
        election.finalized_at_secs = now;
        event::emit(AdminElectionFinalized {
            admin_election_id,
            quorum_met,
            passed,
            yes_votes,
            no_votes,
            abstain_votes,
            finalized_at_secs: now,
        });
    }

    public entry fun execute(creator: &signer, admin_election_id: u64) acquires Registry {
        assert_creator(creator);
        let registry = borrow_global_mut<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow_mut(&mut registry.elections, admin_election_id);
        assert!(election.status == STATUS_FINALIZED && election.passed, E_NOT_PASSED);
        let candidate = election.candidate;
        assert!(!weighted_voting::is_admin(candidate), E_ALREADY_ADMIN);
        weighted_voting::add_admin(creator, candidate);
        let now = timestamp::now_seconds();
        election.status = STATUS_EXECUTED;
        election.executed_at_secs = now;
        event::emit(ElectedAdminAdded {
            admin_election_id,
            candidate,
            executed_by: signer::address_of(creator),
            executed_at_secs: now,
        });
    }

    #[view]
    public fun is_initialized(): bool { exists<Registry>(@aptos_voting) }

    #[view]
    public fun constants(): (u8, u8, u8, u8, u8) {
        (MODE_EQUAL_WALLET, MODE_EXPERT_CATEGORY, CHOICE_YES, CHOICE_NO, CHOICE_ABSTAIN)
    }

    #[view]
    public fun voter_registry(): (u64, u64) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        (registry.voter_registry_version, registry.active_voter_count)
    }

    #[view]
    public fun is_equal_voter(voter: address): bool acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        is_currently_eligible_internal(&registry.voters, voter)
    }

    #[view]
    public fun election_count(): u64 acquires Registry {
        borrow_global<Registry>(@aptos_voting).next_election_id
    }

    #[view]
    public fun election(admin_election_id: u64): (address, u8, u64, u64, vector<u8>, vector<u8>, u64, u64, u64, u64, bool, u64, u64, u8, bool, bool, u64, u64) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&registry.elections, admin_election_id);
        (
            election.candidate,
            election.mode,
            election.category_id,
            election.ballot_id,
            election.metadata_hash,
            election.metadata_uri,
            election.voter_registry_version,
            election.eligible_voters,
            election.pass_bps,
            election.quorum_bps,
            election.allow_revote,
            election.starts_at_secs,
            election.ends_at_secs,
            election.status,
            election.quorum_met,
            election.passed,
            election.finalized_at_secs,
            election.executed_at_secs,
        )
    }

    #[view]
    public fun equal_tallies(admin_election_id: u64): (u64, u64, u64, u64) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&registry.elections, admin_election_id);
        assert!(election.mode == MODE_EQUAL_WALLET, E_WRONG_MODE);
        (election.yes_votes, election.no_votes, election.abstain_votes, election.unique_voters)
    }

    #[view]
    public fun equal_vote_of(admin_election_id: u64, voter: address): (bool, u8) acquires Registry {
        let registry = borrow_global<Registry>(@aptos_voting);
        assert!(table::contains(&registry.elections, admin_election_id), E_ELECTION_NOT_FOUND);
        let election = table::borrow(&registry.elections, admin_election_id);
        if (!table::contains(&election.votes, voter)) {
            return (false, 0)
        };
        (true, *table::borrow(&election.votes, voter))
    }

    fun assert_creator(creator: &signer) {
        assert!(signer::address_of(creator) == weighted_voting::creator(), E_NOT_CREATOR);
    }

    fun is_currently_eligible_internal(voters: &Table<address, VoterRegistration>, voter: address): bool {
        if (!table::contains(voters, voter)) return false;
        let registration = table::borrow(voters, voter);
        if (vector::length(&registration.windows) == 0) return false;
        vector::borrow(&registration.windows, vector::length(&registration.windows) - 1).left_version == 0
    }

    fun is_eligible_at_internal(voters: &Table<address, VoterRegistration>, voter: address, version: u64): bool {
        if (!table::contains(voters, voter)) return false;
        let windows = &table::borrow(voters, voter).windows;
        let index = 0;
        while (index < vector::length(windows)) {
            let window = vector::borrow(windows, index);
            if (window.joined_version <= version && (window.left_version == 0 || version < window.left_version)) {
                return true
            };
            index = index + 1;
        };
        false
    }

    fun add_choice(election: &mut AdminElection, choice: u8) {
        if (choice == CHOICE_YES) election.yes_votes = election.yes_votes + 1
        else if (choice == CHOICE_NO) election.no_votes = election.no_votes + 1
        else election.abstain_votes = election.abstain_votes + 1;
    }

    fun subtract_choice(election: &mut AdminElection, choice: u8) {
        if (choice == CHOICE_YES) election.yes_votes = election.yes_votes - 1
        else if (choice == CHOICE_NO) election.no_votes = election.no_votes - 1
        else election.abstain_votes = election.abstain_votes - 1;
    }
}
