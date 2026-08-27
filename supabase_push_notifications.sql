-- ==========================================================
-- SCHEMA SUPABASE: PUSH NOTIFICATIONS (FCM) - APP PESADÃO
-- Execute este script no SQL Editor do seu painel Supabase
-- ==========================================================

-- 1. TABELA DE ASSINATURAS PUSH (FCM TOKENS)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    fcm_token TEXT UNIQUE NOT NULL,
    device_info TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE CONFIGURAÇÃO DE NOTIFICAÇÕES PROGRAMÁVEIS
CREATE TABLE IF NOT EXISTS public.notifications_config (
    id BIGINT PRIMARY KEY DEFAULT 1,
    -- Notificação 1
    notif1_active BOOLEAN NOT NULL DEFAULT FALSE,
    notif1_title TEXT NOT NULL DEFAULT '',
    notif1_body TEXT NOT NULL DEFAULT '',
    notif1_date TEXT NOT NULL DEFAULT '', -- formato YYYY-MM-DD
    notif1_time TEXT NOT NULL DEFAULT '09:00', -- formato HH:MM
    notif1_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    notif1_error TEXT,
    -- Notificação 2
    notif2_active BOOLEAN NOT NULL DEFAULT FALSE,
    notif2_title TEXT NOT NULL DEFAULT '',
    notif2_body TEXT NOT NULL DEFAULT '',
    notif2_date TEXT NOT NULL DEFAULT '', -- formato YYYY-MM-DD
    notif2_time TEXT NOT NULL DEFAULT '09:00', -- formato HH:MM
    notif2_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    notif2_error TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_notif_config_row CHECK (id = 1)
);

-- Inserir configuração padrão inicial caso não exista
INSERT INTO public.notifications_config (
    id,
    notif1_active, notif1_title, notif1_body, notif1_date, notif1_time, notif1_status,
    notif2_active, notif2_title, notif2_body, notif2_date, notif2_time, notif2_status
)
VALUES (
    1,
    FALSE, 'Pesadão F.C.', 'Não perca nossa próxima partida de domingo!', '', '09:00', 'pending',
    FALSE, 'Mensalidade do Pesadão', 'Lembre-se de realizar o pagamento da mensalidade!', '', '09:00', 'pending'
)
ON CONFLICT (id) DO NOTHING;

-- HABILITAR RLS (Row Level Security)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso aberto para o app (leitura/escrita anônimo e autenticado)
DROP POLICY IF EXISTS "Permitir total push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Permitir total push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total notifications_config" ON public.notifications_config;
CREATE POLICY "Permitir total notifications_config" ON public.notifications_config FOR ALL USING (true) WITH CHECK (true);
