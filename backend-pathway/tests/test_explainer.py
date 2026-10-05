from llm.explainer import numbers_match

SUMMARY = ("TRK-101 is stopped (breakdown); waiting projects 1.2 h late and ₹19,356 exposure. Relief arrives in "
           "3.1 h for ₹10,500, expected cost ₹12,436. Net expected saving ₹6,920.")
OPTIONS = [{"label": "Wait", "direct_cost": 0.0, "expected_cost": 19355.76, "sla_penalty": 19355.76, "spoilage_loss": 0.0}]


def test_explanation_with_engine_figures_is_kept():
    assert numbers_match("Relief costs ₹10,500 and saves ₹6,920 against ₹19,356 at risk.", SUMMARY, OPTIONS)


def test_explanation_with_invented_figure_is_rejected():
    assert not numbers_match("Relief saves ₹8,856 compared with waiting.", SUMMARY, OPTIONS)


def test_explanation_contradicting_the_decision_is_rejected():
    from llm.explainer import matches_decision
    best = "Relief: ExpressRelief Carriers"
    assert matches_decision("ExpressRelief Carriers saves ₹6,920 compared with waiting.", best)
    assert not matches_decision("We recommend waiting for TRK-101; ExpressRelief costs more.", best)
    assert not matches_decision("A relief truck saves ₹6,920.", best)  # doesn't name the carrier


def test_comparison_with_waiting_is_not_mistaken_for_waiting():
    from llm.explainer import matches_decision
    best = "Relief: ExpressRelief Carriers"
    assert matches_decision("ExpressRelief Carriers saves ₹6,920; this option is cheaper than waiting.", best)
    assert not matches_decision("The recommended option is to wait; ExpressRelief costs more.", best)
