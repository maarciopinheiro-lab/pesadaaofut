-- ==============================================================================
-- SCHEMA SUPABASE MESTRE E COMPLETO: APP PESADÃO F.C.
-- Todas as tabelas, colunas, índices, valores padrão e políticas de segurança (RLS).
-- Execute este script no "SQL Editor" do seu painel Supabase (https://app.supabase.com)
-- ==============================================================================

-- 1. TABELA DE ATLETAS / JOGADORES (players)
CREATE TABLE IF NOT EXISTS public.players (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    photo_url TEXT DEFAULT 'https://via.placeholder.com/150',
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_date TEXT, -- Armazena JSON com histórico de meses {"01-2026":"15/01/2026"}
    value NUMERIC NOT NULL DEFAULT 40.00,
    jersey_number INT NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' ou 'injured'
    whatsapp TEXT DEFAULT '',
    position TEXT DEFAULT 'MEI', -- 'GOL', 'LAT', 'ZAG', 'VOL', 'MEI', 'ATA'
    goals INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    last_played_date TEXT,
    overall INT DEFAULT 75,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir todas as colunas em tabelas pré-existentes
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'MEI';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS goals INT DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS matches_played INT DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_played_date TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS overall INT DEFAULT 75;

-- 2. TABELA DE PARTIDAS E RESULTADOS (matches)
CREATE TABLE IF NOT EXISTS public.matches (
    id BIGSERIAL PRIMARY KEY,
    opponent TEXT NOT NULL,
    location_img TEXT,
    location TEXT DEFAULT '',
    uniform TEXT DEFAULT 'Azul', -- 'Azul' ou 'Preto'
    match_type TEXT DEFAULT 'amistoso', -- 'amistoso' ou 'campeonato'
    date TEXT NOT NULL, -- formato YYYY-MM-DD
    time TEXT NOT NULL, -- formato HH:MM
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    result TEXT DEFAULT 'pending', -- 'win', 'loss', 'draw', 'pending'
    is_finished BOOLEAN DEFAULT FALSE,
    lineup JSONB,
    comments TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS uniform TEXT DEFAULT 'Azul';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'amistoso';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lineup JSONB;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS comments TEXT DEFAULT '';

-- 3. TABELA DE CONFIGURAÇÃO DO BOT WHATSAPP (whatsapp_config)
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
    id BIGINT PRIMARY KEY DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    group_id TEXT DEFAULT '',
    group_name TEXT DEFAULT '',
    day_of_week INT NOT NULL DEFAULT 1, -- 0: Domingo, 1: Segunda, 2: Terça, 3: Quarta, 4: Quinta, 5: Sexta, 6: Sábado
    send_time TEXT NOT NULL DEFAULT '09:00',
    message_template TEXT NOT NULL DEFAULT '💰 *COBRANÇA SEMANAL - {nome_grupo}*

Fala, guerreiros! Passando para lembrar da contribuição da semana ({semana}).

💵 *Valor:* R$ {valor}
🔑 *Chave PIX ({pix_tipo}):* {pix}

📊 *Resumo do Mês ({data}):*
• Confirmados/Pagos: {total_pago}
• Pendentes: {total_pendentes}

Quem já realizou o pagamento via PIX, favor enviar o comprovante. Valeu! ⚽🔥',
    billing_type TEXT NOT NULL DEFAULT 'general',
    pix_key TEXT DEFAULT '',
    pix_type TEXT DEFAULT 'chave',
    default_fee NUMERIC DEFAULT 40.00,
    match_group_id TEXT DEFAULT '',
    match_group_name TEXT DEFAULT '',
    match_template TEXT,
    match_auto_send BOOLEAN DEFAULT FALSE,
    billing_schedules TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_config_row CHECK (id = 1)
);

ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS match_group_id TEXT DEFAULT '';
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS match_group_name TEXT DEFAULT '';
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS match_template TEXT;
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS match_auto_send BOOLEAN DEFAULT FALSE;
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS billing_schedules TEXT;

-- Inserir linha única de configuração se não existir
INSERT INTO public.whatsapp_config (
    id, is_active, group_id, group_name, day_of_week, send_time, message_template, billing_type, pix_key, pix_type, default_fee
)
VALUES (
    1, false, '', '', 1, '09:00',
    '💰 *COBRANÇA SEMANAL - {nome_grupo}*

Fala, guerreiros! Passando para lembrar da contribuição da semana ({semana}).

💵 *Valor:* R$ {valor}
🔑 *Chave PIX ({pix_tipo}):* {pix}

📊 *Resumo do Mês ({data}):*
• Confirmados/Pagos: {total_pago}
• Pendentes: {total_pendentes}

Quem já realizou o pagamento via PIX, favor enviar o comprovante. Valeu! ⚽🔥',
    'general', '', 'chave', 40.00
)
ON CONFLICT (id) DO NOTHING;

-- 4. TABELA DE SESSÃO DO WHATSAPP (whatsapp_sessions)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id TEXT PRIMARY KEY DEFAULT 'default',
    status TEXT NOT NULL DEFAULT 'disconnected',
    phone_number TEXT,
    qr_code TEXT,
    last_error TEXT,
    last_connected_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.whatsapp_sessions (id, status)
VALUES ('default', 'disconnected')
ON CONFLICT (id) DO NOTHING;

-- 5. TABELA DE HISTÓRICO DE MENSAGENS ENVIADAS (whatsapp_messages)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    group_name TEXT,
    type TEXT NOT NULL DEFAULT 'auto',
    status TEXT NOT NULL DEFAULT 'sent',
    reference_week TEXT NOT NULL,
    message TEXT NOT NULL,
    error TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ref_week ON public.whatsapp_messages (reference_week, group_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages (sent_at DESC);

-- 6. TABELA DE LOGS DE SISTEMA E DIAGNÓSTICO (whatsapp_logs)
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id BIGSERIAL PRIMARY KEY,
    level TEXT NOT NULL DEFAULT 'info',
    event TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs (created_at DESC);

-- 7. TABELA DE PERSISTÊNCIA DAS CHAVES DO WHATSAPP BAILEYS (whatsapp_auth)
CREATE TABLE IF NOT EXISTS public.whatsapp_auth (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELA DE FILA DE MENSAGENS DO BOT (whatsapp_queue)
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT NOT NULL DEFAULT 'billing',
    destino TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error TEXT,
    execution_key TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_sched ON public.whatsapp_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_exec_key ON public.whatsapp_queue (execution_key);

-- 9. TABELA DE ASSINATURAS PUSH / DISPOSITIVOS REGISTRADOS (push_subscriptions)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    fcm_token TEXT UNIQUE NOT NULL,
    device_info TEXT DEFAULT '',
    player_id TEXT DEFAULT '',
    player_name TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS player_id TEXT DEFAULT '';
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS player_name TEXT DEFAULT '';
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';

-- 10. TABELA DE CONFIGURAÇÃO DE NOTIFICAÇÕES PROGRAMÁVEIS (notifications_config)
CREATE TABLE IF NOT EXISTS public.notifications_config (
    id BIGINT PRIMARY KEY DEFAULT 1,
    -- Notificação 1
    notif1_active BOOLEAN NOT NULL DEFAULT FALSE,
    notif1_title TEXT NOT NULL DEFAULT '',
    notif1_body TEXT NOT NULL DEFAULT '',
    notif1_date TEXT NOT NULL DEFAULT '',
    notif1_time TEXT NOT NULL DEFAULT '09:00',
    notif1_status TEXT NOT NULL DEFAULT 'pending',
    notif1_error TEXT,
    -- Notificação 2
    notif2_active BOOLEAN NOT NULL DEFAULT FALSE,
    notif2_title TEXT NOT NULL DEFAULT '',
    notif2_body TEXT NOT NULL DEFAULT '',
    notif2_date TEXT NOT NULL DEFAULT '',
    notif2_time TEXT NOT NULL DEFAULT '09:00',
    notif2_status TEXT NOT NULL DEFAULT 'pending',
    notif2_error TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_notif_config_row CHECK (id = 1)
);

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

-- ==============================================================================
-- HABILITAR ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO TOTAL PARA O APP
-- ==============================================================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso aberto (Anon / Authenticated / Service Role)
DROP POLICY IF EXISTS "Permitir total players" ON public.players;
CREATE POLICY "Permitir total players" ON public.players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total matches" ON public.matches;
CREATE POLICY "Permitir total matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Permitir total whatsapp_config" ON public.whatsapp_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Permitir total whatsapp_sessions" ON public.whatsapp_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Permitir total whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir total whatsapp_logs" ON public.whatsapp_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total whatsapp_auth" ON public.whatsapp_auth;
CREATE POLICY "Permitir total whatsapp_auth" ON public.whatsapp_auth FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total whatsapp_queue" ON public.whatsapp_queue;
CREATE POLICY "Permitir total whatsapp_queue" ON public.whatsapp_queue FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Permitir total push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir total notifications_config" ON public.notifications_config;
CREATE POLICY "Permitir total notifications_config" ON public.notifications_config FOR ALL USING (true) WITH CHECK (true);
