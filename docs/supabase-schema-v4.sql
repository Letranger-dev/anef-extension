-- =============================================
-- ANEF Stats - Schema Migration v4
-- Ajout checked_at (date de dernière vérification)
-- Executer dans : Supabase > SQL Editor
-- =============================================

-- Nouvelle colonne pour tracker quand l'extension a vérifié pour la dernière fois
ALTER TABLE dossier_snapshots ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ DEFAULT now();

-- Mettre à jour les lignes existantes : utiliser created_at comme valeur initiale
UPDATE dossier_snapshots SET checked_at = created_at WHERE checked_at IS NULL;
