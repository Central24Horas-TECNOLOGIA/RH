# ADR-002 — Docker e ambientes imutáveis

**Status:** aceito em 24/06/2026.

Backend e frontend produzem imagens separadas, executadas como artefatos versionados.
HML e PROD não fazem build no servidor; recebem a mesma imagem promovida pelo pipeline.
