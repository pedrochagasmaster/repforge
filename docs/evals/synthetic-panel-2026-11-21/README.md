# Synthetic review panel, 2026-11-21

200 persona-primed LLM respondents (20 audience segments x 10) reviewed the
Taurifer concept, following the design of Maier et al., "LLMs Reproduce Human
Purchase Intent via Semantic Similarity Elicitation of Likert Ratings"
(arXiv 2510.08338). The output is a set of hypotheses for the alpha. It is not
market evidence: there is no human baseline, and answers within a segment are
strongly correlated.

- `reviews.csv` / `scored.json`: every respondent's persona, free-text answers,
  direct 1-5 ratings and semantic-similarity ratings.
- `personas.json`: the panel. `wf.js`: the generator and the survey prompt.
- `stimulus/concept.md`: the concept text shown. The three screenshot sheets
  were 4x1 montages of `docs/ui-screens/screens` frames at
  `phone-390-light-{en,pt}`: first-run, first-run-ways, desired-result, result;
  today/ready, workout/focus, why-this-weight, rest-running; session/summary,
  progress/overview, progress/strength, program/overview.
- `ssr.py`: the similarity rating, with local embeddings and anchors written
  for this run (the paper's anchors are unpublished). Its scores bunched near
  the scale midpoint and correlated only about 0.5 with the direct ratings.
- `themes.json`: keyword-coded theme counts per segment.
