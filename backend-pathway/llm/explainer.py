"""
LLM explanations for arbitrage decisions.

The engine decides; the LLM only rewords the decision for a human. Text that disagrees with
the engine's figures or choice is dropped. Runs as a fully-async Pathway UDF with caching,
so a slow local model never blocks the stream (rows show "pending" first).
"""

import asyncio
import json
import re

import pathway as pw

from llm.llm_client import LLMClient

SYSTEM_PROMPT = (
    "You are a logistics operations analyst. Explain a pre-computed decision to a fleet "
    "manager in at most 2 short sentences: what we recommend and why it is cheaper than waiting. "
    "Copy numbers exactly as given; never calculate new ones. 'Exposure' is the money lost if we "
    "wait; the saving is what the recommended option saves compared with waiting. Do not mention "
    "contract clauses or reasons that are not in the summary. No preamble."
)

_RUPEES = re.compile(r"₹\s?([\d,]+(?:\.\d+)?)")


def numbers_match(text: str, summary: str, options: list, terms: str = "") -> bool:
    """True if every ₹ amount the model wrote is one the engine produced (±₹1).

    Small local models occasionally invent or mislabel figures; the dashboard then shows the
    deterministic summary instead. Decisions never depend on this text.
    """
    known = {float(m.replace(",", "")) for m in _RUPEES.findall(summary + " " + terms)}
    for o in options:
        known.update(float(o[k]) for k in ("direct_cost", "expected_cost", "sla_penalty", "spoilage_loss")
                     if isinstance(o.get(k), (int, float)))
    quoted = [float(m.replace(",", "")) for m in _RUPEES.findall(text)]
    return all(any(abs(q - k) <= 1 for k in known) for q in quoted)


_SAYS_WAIT = re.compile(r"\b(recommend\w*|option is|best (option|choice) is)\s+(to\s+|for\s+)?(simply\s+)?wait", re.I)


def matches_decision(text: str, best: str) -> bool:
    """True if the text names the chosen option and doesn't tell the reader to wait instead."""
    name = best.split(":", 1)[-1].strip().split(" ")[0].lower()  # "Relief: ExpressRelief Carriers" -> "expressrelief"
    return (not name or name in text.lower()) and not _SAYS_WAIT.search(text)


def build_explainer(client: LLMClient):
    @pw.udf(executor=pw.udfs.fully_async_executor(), cache_strategy=pw.udfs.InMemoryCache())
    async def explain(key: str, summary: str, options_json: str, contract_terms: str) -> str:
        options = json.loads(options_json)
        brief = [{k: o[k] for k in ("label", "direct_cost", "expected_cost", "arrival_hours",
                                    "lateness_hours", "reliability")} for o in options]
        best = key.split("|", 1)[1] if "|" in key else ""  # key = incident_id|chosen option
        # Contract terms are left out on purpose: small models invent clause reasoning. The summary
        # already carries what matters (lateness, penalty exposure, spoilage).
        prompt = (f"RECOMMENDED: {best}. Waiting was rejected because it costs more.\n"
                  f"Decision summary: {summary}\n\nOptions considered: {json.dumps(brief)}")
        try:
            text = await asyncio.to_thread(
                client.chat,
                [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
                0.2, 200,
            )
            text = re.sub(r"^\s*RECOMMENDED:\s*", "", text.strip())  # small models echo the prompt label
            if not numbers_match(text, summary, options, contract_terms) or not matches_decision(text, best):
                print(f"⚠️  LLM explanation for {key} did not match the engine's decision; using the summary")
                return ""
            return text
        except Exception as e:  # LLM is optional: the deterministic summary is always available
            print(f"⚠️  LLM explanation failed for {key}: {e}")
            return ""

    return explain
