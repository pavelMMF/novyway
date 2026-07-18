from math import isclose


def nominal_weight(n0, q0, qk, nk, dk):
    rk = max(nk, dk)
    if rk <= 0:
        raise ValueError("reference denominator must be positive")
    return qk * n0 / (q0 * rk)


def actual_component(nominal, floor, freshness=1.0):
    if not 0 <= freshness <= 1:
        raise ValueError("freshness outside [0, 1]")
    return floor + (max(nominal, floor) - floor) * freshness


def run():
    n0 = 70
    q0 = 0.25
    expected = ((0.15, 15, 2.8), (0.25, 10, 7.0), (0.35, 5, 19.6))
    for qk, nk, want in expected:
        got = nominal_weight(n0, q0, qk, nk, nk)
        assert isclose(got, want), (got, want)

    # Gatekeeping protection: admitting one of five potential experts does not
    # increase the remaining person's nominal weight.
    full = nominal_weight(70, 0.25, 0.35, 5, 5)
    narrowed = nominal_weight(70, 0.25, 0.35, 1, 5)
    assert isclose(full, narrowed)

    # Strict expert precedence is maintained by the floor, not an upper cap.
    amax = 0.5
    expert_floor = 1.6
    civic_residual = 0.2
    max_nonexpert = 1 + civic_residual + amax
    min_expert = actual_component(0.2, expert_floor, freshness=0) + civic_residual
    assert min_expert > max_nonexpert

    # No expert cap: a genuinely unique expert may receive a very large weight.
    unique = nominal_weight(5_040_000, 0.25, 0.35, 1, 1)
    assert isclose(unique, 7_056_000)

    # Large calibrated example: one highest-level expert per thousand voters.
    scaled = nominal_weight(5_040_000, 0.25, 0.35, 7_200, 7_200)
    assert isclose(scaled, 980)

    print("weight-model checks passed")
    print({"small": [2.8, 7.0, 19.6], "scaled_L3": scaled, "unique_L3": unique})


if __name__ == "__main__":
    run()
