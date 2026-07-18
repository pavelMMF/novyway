#[test_only]
module aptos_voting::weighted_voting_tests {
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_voting::weighted_voting;

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting)]
    fun initializes_one_of_one(aptos_framework: &signer, creator: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        assert!(weighted_voting::is_initialized(), 1001);
        assert!(weighted_voting::weight_scale() == 1_000_000, 1002);
        assert!(weighted_voting::admin_threshold() == 1, 1003);
        let (council, policy, membership) = weighted_voting::versions();
        assert!(council == 1 && policy == 1 && membership == 0, 1004);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        admin_two = @0x43,
        admin_three = @0x44,
        voter = @0x100,
    )]
    fun qualification_requires_two_of_three(
        aptos_framework: &signer,
        creator: &signer,
        admin_two: &signer,
        admin_three: &signer,
        voter: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        weighted_voting::add_admin(creator, signer::address_of(admin_two));
        weighted_voting::add_admin(creator, signer::address_of(admin_three));
        assert!(weighted_voting::admin_threshold() == 2, 1101);
        propose_level(creator, voter, 0, 0, 0, 1);
        let (found_before, _, eligible_before, _, _, _, _, _) =
            weighted_voting::current_qualification(signer::address_of(voter), 0);
        assert!(!found_before && !eligible_before, 1102);
        weighted_voting::approve_qualification(admin_two, 0);
        let (found, level, eligible, _, manual_weight, version, _, _) =
            weighted_voting::current_qualification(signer::address_of(voter), 0);
        assert!(found && eligible && level == 0, 1103);
        assert!(manual_weight == 0 && version == 1, 1104);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        l0 = @0x100,
        l1_manual = @0x101,
        l1_auto = @0x102,
        l2 = @0x103,
        l3 = @0x104,
    )]
    fun snapshot_derives_quota_weights_and_manual_remainder(
        aptos_framework: &signer,
        creator: &signer,
        l0: &signer,
        l1_manual: &signer,
        l1_auto: &signer,
        l2: &signer,
        l3: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        create_economics(creator);
        propose_level(creator, l0, 1, 0, 0, 1);
        propose_level(creator, l1_manual, 1, 1, 200_000, 2);
        propose_level(creator, l1_auto, 1, 1, 0, 3);
        propose_level(creator, l2, 1, 2, 0, 4);
        propose_level(creator, l3, 1, 3, 0, 5);
        weighted_voting::create_election(creator, 1, hash32(10), b"ipfs://election", 0, 100, 5_000, 0, true);

        let (quotas, _, cap, counts, manual_counts, manual_sums, targets, weights, remainders, eligible_total) =
            weighted_voting::election_snapshot(0);
        assert!(*vector::borrow(&quotas, 3) == 3_500 && cap == 25_000_000, 1201);
        assert!(*vector::borrow(&counts, 1) == 2, 1202);
        assert!(*vector::borrow(&manual_counts, 1) == 1 && *vector::borrow(&manual_sums, 1) == 200_000, 1203);
        assert!(*vector::borrow(&targets, 1) == 600_000, 1204);
        assert!(*vector::borrow(&weights, 0) == 1_000_000, 1205);
        assert!(*vector::borrow(&weights, 1) == 400_000, 1206);
        assert!(*vector::borrow(&weights, 2) == 1_000_000, 1207);
        assert!(*vector::borrow(&weights, 3) == 1_400_000, 1208);
        assert!(*vector::borrow(&remainders, 1) == 0 && eligible_total == 4_000_000, 1209);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        voter = @0x100,
    )]
    fun snapshot_freezes_level_and_revote_replaces_tally(
        aptos_framework: &signer,
        creator: &signer,
        voter: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://frozen", 0, 100, 5_000, 0, true);
        propose_level(creator, voter, 0, 1, 0, 3);

        weighted_voting::cast_vote(voter, 0, 10_000, 0, 0);
        let (exists, revision, weight, multiplier, _, _, _, _) = weighted_voting::vote_of(0, signer::address_of(voter));
        assert!(exists && revision == 1 && weight == 1_000_000, 1301);
        assert!(multiplier == 10_000, 1304);
        weighted_voting::cast_vote(voter, 0, 2_500, 5_000, 2_500);
        let (yes, no, abstain, voters) = weighted_voting::election_tallies(0);
        assert!(yes == 2_500_000_000 && no == 5_000_000_000, 1302);
        assert!(abstain == 2_500_000_000 && voters == 1, 1303);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        voter = @0x100,
    )]
    fun exact_fifty_percent_passes(aptos_framework: &signer, creator: &signer, voter: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://fifty", 0, 10, 5_000, 10_000, true);
        weighted_voting::cast_vote(voter, 0, 5_000, 5_000, 0);
        timestamp::fast_forward_seconds(10);
        weighted_voting::finalize(voter, 0);
        let (finalized, quorum, passed) = weighted_voting::election_result(0);
        assert!(finalized && quorum && passed, 1401);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        l1 = @0x100,
    )]
    #[expected_failure(abort_code = 33, location = aptos_voting::weighted_voting)]
    fun rejects_snapshot_without_level_zero(aptos_framework: &signer, creator: &signer, l1: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        create_economics(creator);
        propose_level(creator, l1, 1, 1, 0, 1);
        weighted_voting::create_election(creator, 1, hash32(2), b"ipfs://no-l0", 0, 100, 5_000, 0, true);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        voter = @0x100,
    )]
    #[expected_failure(abort_code = 21, location = aptos_voting::weighted_voting)]
    fun rejects_invalid_fractional_ballot(aptos_framework: &signer, creator: &signer, voter: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://bad-ballot", 0, 100, 5_000, 0, true);
        weighted_voting::cast_vote(voter, 0, 5_000, 4_000, 0);
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting)]
    #[expected_failure(abort_code = 12, location = aptos_voting::weighted_voting)]
    fun rejects_policy_cap_reduction(aptos_framework: &signer, creator: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        create_economics(creator);
        weighted_voting::propose_policy_change(
            creator,
            1,
            2_500, 1_500, 2_500, 3_500,
            0, 0, 0, 0,
            20_000_000,
            hash32(8),
            b"ipfs://unsafe-cap-reduction",
            1_000,
        );
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        admin_two = @0x43,
        admin_three = @0x44,
        admin_four = @0x45,
        voter = @0x100,
    )]
    #[expected_failure(abort_code = 16, location = aptos_voting::weighted_voting)]
    fun council_change_invalidates_proposal(
        aptos_framework: &signer,
        creator: &signer,
        admin_two: &signer,
        admin_three: &signer,
        admin_four: &signer,
        voter: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        weighted_voting::add_admin(creator, signer::address_of(admin_two));
        weighted_voting::add_admin(creator, signer::address_of(admin_three));
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::add_admin(creator, signer::address_of(admin_four));
        weighted_voting::approve_qualification(admin_two, 0);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        l0_a = @0x100,
        l0_b = @0x101,
        l3 = @0x104,
    )]
    fun expert_weight_degrades_and_stops_at_base(
        aptos_framework: &signer,
        creator: &signer,
        l0_a: &signer,
        l0_b: &signer,
        l3: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        create_economics(creator);
        propose_level(creator, l0_a, 1, 0, 0, 1);
        propose_level(creator, l0_b, 1, 0, 0, 2);
        propose_level(creator, l3, 1, 3, 0, 3);
        let (period_secs, keep_bps, _) = weighted_voting::degradation_params();
        assert!(period_secs == 15_778_800 && keep_bps == 8_500, 1601);

        // Two half-year periods after confirmation: 0.85^2 = 72.25%.
        timestamp::fast_forward_seconds(2 * period_secs);
        weighted_voting::create_election(creator, 1, hash32(10), b"ipfs://degrade", 0, timestamp::now_seconds() + 100, 5_000, 0, true);
        // Snapshot: N0=2 -> t3 = 2 * 1e6 * 3500 / 2500 = 2_800_000, one L3 member.
        let (preview_ok, preview_weight, preview_mult) =
            weighted_voting::voting_weight_preview(0, signer::address_of(l3));
        assert!(preview_ok && preview_mult == 7_225, 1602);
        assert!(preview_weight == 2_023_000, 1603);
        weighted_voting::cast_vote(l3, 0, 10_000, 0, 0);
        let (exists, _, weight, multiplier, _, _, _, _) = weighted_voting::vote_of(0, signer::address_of(l3));
        assert!(exists && weight == 2_023_000 && multiplier == 7_225, 1604);
        // A level-zero voter never degrades.
        weighted_voting::cast_vote(l0_a, 0, 10_000, 0, 0);
        let (_, _, base_weight, base_mult, _, _, _, _) = weighted_voting::vote_of(0, signer::address_of(l0_a));
        assert!(base_weight == 1_000_000 && base_mult == 10_000, 1605);

        // Twenty-eight more periods (30 total): decay bottoms out at the
        // base citizen weight, never below.
        timestamp::fast_forward_seconds(28 * period_secs);
        weighted_voting::create_election(creator, 1, hash32(11), b"ipfs://degrade-floor", 0, timestamp::now_seconds() + 100, 5_000, 0, true);
        let (ok_two, floor_weight, floor_mult) =
            weighted_voting::voting_weight_preview(1, signer::address_of(l3));
        assert!(ok_two && floor_weight == 1_000_000, 1606);
        assert!(floor_mult < 7_225, 1607);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        l0 = @0x100,
        l1 = @0x101,
    )]
    fun floor_lifts_thin_quota_pool(
        aptos_framework: &signer,
        creator: &signer,
        l0: &signer,
        l1: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        weighted_voting::create_category(
            creator,
            b"ThinPool",
            b"ipfs://thin",
            hash32(7),
            9_000, 1_000, 0, 0,
            0, 2_000_000, 0, 0,
            25_000_000,
        );
        propose_level(creator, l0, 1, 0, 0, 1);
        propose_level(creator, l1, 1, 1, 0, 2);
        weighted_voting::create_election(creator, 1, hash32(12), b"ipfs://floor", 0, 100, 5_000, 0, true);
        let (_, _, _, _, _, _, _, weights, _, eligible_total) = weighted_voting::election_snapshot(0);
        // Raw derived weight would be 1e6 * 1000 / 9000 = 111_111; the floor
        // guarantee lifts every L1 member to 2_000_000.
        assert!(*vector::borrow(&weights, 1) == 2_000_000, 1701);
        assert!(eligible_total == 3_000_000, 1702);
        weighted_voting::cast_vote(l1, 0, 10_000, 0, 0);
        let (_, _, weight, _, _, _, _, _) = weighted_voting::vote_of(0, signer::address_of(l1));
        assert!(weight == 2_000_000, 1703);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        voter_one = @0x100,
        voter_two = @0x101,
    )]
    fun quorum_bps_counts_participation_against_snapshot(
        aptos_framework: &signer,
        creator: &signer,
        voter_one: &signer,
        voter_two: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter_one, 0, 0, 0, 1);
        propose_level(creator, voter_two, 0, 0, 0, 2);
        // Eligible total 2_000_000; quorum 60% needs 1_200_000 participating.
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://quorum", 0, 10, 5_000, 6_000, true);
        weighted_voting::cast_vote(voter_one, 0, 10_000, 0, 0);
        timestamp::fast_forward_seconds(10);
        weighted_voting::finalize(voter_one, 0);
        let (finalized, quorum, passed) = weighted_voting::election_result(0);
        assert!(finalized && !quorum && !passed, 1801);
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting, voter = @0x100)]
    #[expected_failure(abort_code = 37, location = aptos_voting::weighted_voting)]
    fun rejects_quorum_above_hundred_percent(aptos_framework: &signer, creator: &signer, voter: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://bad-quorum", 0, 100, 5_000, 10_001, true);
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting, voter = @0x100)]
    fun revote_archives_previous_ballot_only(aptos_framework: &signer, creator: &signer, voter: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://revisions", 0, 100, 5_000, 0, true);
        weighted_voting::cast_vote(voter, 0, 2_500, 5_000, 2_500);
        weighted_voting::cast_vote(voter, 0, 10_000, 0, 0);
        // Only the superseded ballot occupies a revision slot.
        let (rev_voter, rev_revision, rev_weight, _, rev_yes, rev_no, rev_abstain, _, replaced_at) =
            weighted_voting::vote_revision(0, 0);
        assert!(rev_voter == signer::address_of(voter) && rev_revision == 1, 1901);
        assert!(rev_weight == 1_000_000 && rev_yes == 2_500 && rev_no == 5_000 && rev_abstain == 2_500, 1902);
        assert!(replaced_at == timestamp::now_seconds(), 1903);
        let (yes, no, abstain, voters) = weighted_voting::election_tallies(0);
        assert!(yes == 10_000_000_000 && no == 0 && abstain == 0 && voters == 1, 1904);
    }

    #[test(aptos_framework = @aptos_framework, creator = @aptos_voting, voter = @0x100)]
    #[expected_failure(abort_code = 29, location = aptos_voting::weighted_voting)]
    fun first_vote_creates_no_revision_row(aptos_framework: &signer, creator: &signer, voter: &signer) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        propose_level(creator, voter, 0, 0, 0, 1);
        weighted_voting::create_election(creator, 0, hash32(2), b"ipfs://lean", 0, 100, 5_000, 0, true);
        weighted_voting::cast_vote(voter, 0, 10_000, 0, 0);
        let (_, _, _, _, _, _, _, _, _) = weighted_voting::vote_revision(0, 0);
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @aptos_voting,
        admin_two = @0x43,
        l0 = @0x100,
        l1_manual = @0x101,
    )]
    #[expected_failure(abort_code = 34, location = aptos_voting::weighted_voting)]
    fun policy_proposal_fails_fast_when_manual_exceeds_target(
        aptos_framework: &signer,
        creator: &signer,
        admin_two: &signer,
        l0: &signer,
        l1_manual: &signer,
    ) {
        start_time(aptos_framework);
        weighted_voting::initialize(creator);
        create_economics(creator);
        propose_level(creator, l0, 1, 0, 0, 1);
        propose_level(creator, l1_manual, 1, 1, 200_000, 2);
        weighted_voting::add_admin(creator, signer::address_of(admin_two));
        // Two admins: the proposal cannot auto-apply, so the abort proves the
        // fail-fast validation at propose time. New L1 target would be
        // 1e6 * 100 / 9800 = 10_204 < the 200_000 manual override.
        weighted_voting::propose_policy_change(
            creator,
            1,
            9_800, 100, 50, 50,
            0, 0, 0, 0,
            25_000_000,
            hash32(8),
            b"ipfs://squeeze-manual",
            1_000,
        );
    }

    fun create_economics(admin: &signer) {
        weighted_voting::create_category(
            admin,
            b"Economics",
            b"ipfs://economics",
            hash32(9),
            2_500, 1_500, 2_500, 3_500,
            0, 0, 0, 0,
            25_000_000,
        );
    }

    fun propose_level(admin: &signer, voter: &signer, category: u64, level: u8, manual_weight: u64, seed: u8) {
        weighted_voting::propose_qualification(
            admin,
            signer::address_of(voter),
            category,
            level,
            true,
            hash32(seed),
            manual_weight,
            b"ipfs://qualification",
            1_000,
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
