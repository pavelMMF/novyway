#[test_only]
module aptos_voting::admin_election_tests {
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_voting::admin_election;
    use aptos_voting::weighted_voting;

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        voter = @0x100,
        candidate = @0x200,
    )]
    fun equal_wallet_election_adds_admin(
        aptos_framework: &signer,
        creator: &signer,
        voter: &signer,
        candidate: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        admin_election::initialize(creator);
        admin_election::register_equal_voter(creator, signer::address_of(voter));
        admin_election::create_election(
            creator,
            signer::address_of(candidate),
            0,
            0,
            hash32(1),
            b"ipfs://admin/equal",
            0,
            10,
            5_000,
            10_000,
            false,
        );
        admin_election::cast_equal_vote(voter, 0, 1);
        timestamp::fast_forward_seconds(10);
        admin_election::finalize(voter, 0);
        admin_election::execute(creator, 0);
        assert!(weighted_voting::is_admin(signer::address_of(candidate)), 1001);
        let (_, _, _, _, _, _, _, _, _, _, _, _, _, status, quorum, passed, _, executed_at) =
            admin_election::election(0);
        assert!(status == 2 && quorum && passed && executed_at > 0, 1002);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        voter = @0x100,
        candidate = @0x201,
    )]
    fun expert_election_uses_category_snapshot(
        aptos_framework: &signer,
        creator: &signer,
        voter: &signer,
        candidate: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        admin_election::initialize(creator);
        weighted_voting::propose_qualification(
            creator,
            signer::address_of(voter),
            0,
            0,
            true,
            hash32(2),
            0,
            b"ipfs://qualification",
            1_000,
        );
        admin_election::create_election(
            creator,
            signer::address_of(candidate),
            1,
            0,
            hash32(3),
            b"ipfs://admin/expert",
            0,
            10,
            5_000,
            10_000,
            true,
        );
        admin_election::cast_expert_vote(voter, 0, 10_000, 0, 0);
        timestamp::fast_forward_seconds(10);
        admin_election::finalize(voter, 0);
        admin_election::execute(creator, 0);
        assert!(weighted_voting::is_admin(signer::address_of(candidate)), 1101);
        let (_, mode, category, ballot_id, _, _, _, _, _, _, _, _, _, status, quorum, passed, _, _) =
            admin_election::election(0);
        assert!(mode == 1 && category == 0 && ballot_id == 0, 1102);
        assert!(status == 2 && quorum && passed, 1103);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        other_admin = @0x43,
    )]
    #[expected_failure(abort_code = 38, location = aptos_voting::weighted_voting)]
    fun creator_cannot_be_removed(
        aptos_framework: &signer,
        creator: &signer,
        other_admin: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        weighted_voting::add_admin(creator, signer::address_of(other_admin));
        weighted_voting::remove_admin(creator, signer::address_of(creator));
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
