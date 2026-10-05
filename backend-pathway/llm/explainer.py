"""
LLM explanations for arbitrage decisions.

The engine decides; the LLM explains the decision to a human and flags
contract clauses that matter. Runs as a fully-async Pathway UDF with caching,
so a slow local model never blocks the stream (rows show "pending" first).
"""

import asyncio
import json

import pathway as pw

from llm.llm_client import LLMClient

SYSTEM_PROMPT = (
    "You are a logistics operations analyst. Explain a pre-computed decision to a fleet "
    "manager in at most 3 short sentences. Use only the numbers given. Mention any contract "
    "clause that changes the risk (force majeure, cold chain, grace period). No preamble."
)


def build_explainer(client: LLMClient):
    @pw.udf(executor=pw.udfs.fully_async_executor(), cache_strategy=pw.udfs.InMemoryCache())
    async def explain(key: str, summary: str, options_json: str, contract_terms: str) -> str:
        options = json.loads(options_json)
        brief = [{k: o[k] for k in ("label", "direct_cost", "expected_cost", "arrival_hours",
                                    "lateness_hours", "reliability")} for o in options]
        prompt = (f"Decision summary: {summary}\n\nOptions considered: {json.dumps(brief)}\n\n"
                  f"Contract terms:\n{contract_terms[:1500]}")
        try:
            return await asyncio.to_thread(
                client.chat,
                [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
                0.2, 200,
            )
        except Exception as e:  # LLM is optional: the deterministic summary is always available
            print(f"⚠️  LLM explanation failed for {key}: {e}")
            return ""

    return explain
