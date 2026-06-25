IF DB_NAME() NOT IN ('Conecta_DEV', 'Conecta_HML')
    THROW 51010, 'Seeds são permitidos somente em DEV ou HML.', 1;

-- Inserir aqui apenas dados sintéticos e idempotentes. Nunca usar currículos reais.
SELECT 'Ambiente autorizado para seed sintético.' AS status;
