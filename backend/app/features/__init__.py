"""Product features layered over the retrieval service.

Decision records, cross-repo search, supersession pairs, ADR export,
audit reports and the GitHub webhook receiver. Everything here reads
from data the retrieval layer already materialised (fixture contexts or
the live service's cached decision threads); nothing in this package
calls an LLM, so every endpoint stays fast.
"""
