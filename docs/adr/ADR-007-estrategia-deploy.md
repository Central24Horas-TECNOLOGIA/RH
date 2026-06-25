# ADR-007 — Deploy e rollback

**Status:** aceito em 24/06/2026.

Imagens recebem versão semântica imutável e são promovidas DEV → HML → PROD. O deploy
troca a tag somente após readiness. Rollback restaura a tag anterior; migrations são
preferencialmente aditivas e compatíveis com a versão anterior.
