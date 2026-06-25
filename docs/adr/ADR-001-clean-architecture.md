# ADR-001 — Clean Architecture incremental

**Status:** aceito em 24/06/2026.

## Decisão

Separar regras puras (`domain`), casos de uso (`application`), adapters externos
(`infrastructure`) e HTTP (`interfaces`). A migração usa adapters para preservar os
imports e endpoints existentes.

## Consequências

Reduz acoplamento e permite testes sem SQL Server. Durante a transição existe uma
duplicidade intencional de caminhos, controlada pelo plano incremental.
