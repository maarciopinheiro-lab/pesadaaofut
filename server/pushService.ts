import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getAdminSupabase } from './supabaseAdmin';

// Inicialização do Firebase Admin SDK de forma preguiçosa (Lazy) e segura
let isFirebaseInitialized = false;

function ensureFirebaseAdmin(): void {
  if (isFirebaseInitialized) return;

  try {
    if (getApps().length === 0) {
      let serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID || 'pesadaofut-ea90e';

      if (serviceAccountStr) {
        try {
          serviceAccountStr = serviceAccountStr.trim();
          if (
            (serviceAccountStr.startsWith("'") && serviceAccountStr.endsWith("'")) ||
            (serviceAccountStr.startsWith('"') && serviceAccountStr.endsWith('"'))
          ) {
            serviceAccountStr = serviceAccountStr.slice(1, -1).trim();
          }

          if (!serviceAccountStr.startsWith('{')) {
            try {
              const decoded = Buffer.from(serviceAccountStr, 'base64').toString('utf8');
              if (decoded.startsWith('{')) {
                serviceAccountStr = decoded;
              }
            } catch (b64Err) {
              console.warn('[FirebaseAdmin] Falha ao tentar decodificar como base64:', b64Err);
            }
          }

          const serviceAccount = JSON.parse(serviceAccountStr);
          initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id || projectId
          });
          console.log('[FirebaseAdmin] Inicializado com sucesso via FIREBASE_SERVICE_ACCOUNT.');
        } catch (jsonErr) {
          console.error('[FirebaseAdmin] Falha ao fazer parse de FIREBASE_SERVICE_ACCOUNT:', jsonErr);
          throw jsonErr;
        }
      } else if (clientEmail && privateKey) {
        const pKey = privateKey.replace(/\\n/g, '\n');
        initializeApp({
          credential: cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: pKey,
          }),
          projectId: projectId
        });
        console.log('[FirebaseAdmin] Inicializado com sucesso via credenciais explícitas do .env.');
      } else {
        // Fallback para quando não há chaves explicitas
        initializeApp({
          projectId: projectId
        });
        console.log('[FirebaseAdmin] Inicializado usando credencial padrão de ambiente (ADC).');
      }
    }
    isFirebaseInitialized = true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] Erro fatal ao inicializar Firebase Admin SDK:', err);
    throw err;
  }
}

/**
 * Envia uma notificação push para todos os dispositivos registrados.
 * Limpa automaticamente tokens que não são mais válidos.
 */
export async function sendPushToAll(title: string, body: string, customData: Record<string, string> = {}): Promise<{ successCount: number; failureCount: number }> {
  ensureFirebaseAdmin();

  const supabase = getAdminSupabase();
  if (!supabase) {
    throw new Error('Supabase client indisponível.');
  }

  // 1. Obter todos os tokens registrados
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('fcm_token');

  if (error) {
    console.error('[PushService] Erro ao buscar assinaturas de push:', error);
    throw error;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[PushService] Nenhuma assinatura push registrada no banco.');
    return { successCount: 0, failureCount: 0 };
  }

  const tokens = subscriptions.map((s: any) => s.fcm_token).filter(Boolean);
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  console.log(`[PushService] Enviando push para ${tokens.length} dispositivos...`);

  // 2. Montar mensagem multicast
  const message = {
    tokens: tokens,
    notification: {
      title: title,
      body: body,
    },
    data: customData,
    webpush: {
      headers: {
        Urgency: 'high'
      },
      notification: {
        title: title,
        body: body,
        icon: 'https://i.imgur.com/CxbCPR5.png',
        badge: 'https://i.imgur.com/CxbCPR5.png',
        vibrate: [100, 50, 100],
      },
      fcmOptions: {
        link: '/'
      }
    }
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`[PushService] Resultado do multicast: ${response.successCount} sucessos, ${response.failureCount} falhas.`);

    // 3. Processar erros e deletar tokens inválidos
    const tokensToDelete: string[] = [];
    response.responses.forEach((res, index) => {
      if (!res.success && res.error) {
        const token = tokens[index];
        const errCode = res.error.code;
        console.warn(`[PushService] Falha ao enviar para o token ${token.substring(0, 12)}... Erro: ${errCode}`);
        
        // Se o token estiver expirado ou for inválido, marcamos para remoção
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration' ||
          errCode === 'messaging/invalid-argument'
        ) {
          tokensToDelete.push(token);
        }
      }
    });

    if (tokensToDelete.length > 0) {
      console.log(`[PushService] Removendo ${tokensToDelete.length} tokens inválidos/expirados do banco de dados...`);
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('fcm_token', tokensToDelete);

      if (deleteError) {
        console.error('[PushService] Erro ao deletar tokens inválidos:', deleteError);
      }
    }

    // Registrar no histórico de mensagens (no formato compatível com o app se necessário)
    // Para simplificar, o histórico pode ser lido da tabela de configurações ou logs de sistema
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (err: any) {
    console.error('[PushService] Erro fatal no envio multicast:', err);
    
    const errMsg = err.message || '';
    if (
      errMsg.includes('credential') || 
      errMsg.includes('auth') || 
      errMsg.includes('token') || 
      errMsg.includes('permission') ||
      errMsg.includes('unauthenticated') ||
      errMsg.includes('Key') ||
      err.code === 'messaging/authentication-error'
    ) {
      throw new Error(
        'Falha de Autenticação com o Firebase Cloud Messaging. ' +
        'O servidor precisa das credenciais da conta de serviço (Service Account JSON) do seu projeto Firebase ' +
        'para poder enviar mensagens. Adicione a variável de ambiente FIREBASE_SERVICE_ACCOUNT ' +
        'com o conteúdo completo do seu JSON de conta de serviço no menu de Configurações (Settings).'
      );
    }
    throw err;
  }
}

/**
 * Função de verificação agendada executada pelo cron.
 * Compara as configurações salvas com o horário atual de America/Sao_Paulo
 */
export async function checkAndSendScheduledNotifications(): Promise<void> {
  const supabase = getAdminSupabase();
  if (!supabase) return;

  try {
    // 1. Obter a configuração única
    const { data: config, error } = await supabase
      .from('notifications_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !config) {
      console.error('[PushService] Erro ao carregar configurações de notificação agendada:', error);
      return;
    }

    // 2. Obter data e hora atuais no fuso America/Sao_Paulo
    const now = new Date();
    
    const dtfDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const dtfTime = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Formato pt-BR retorna DD/MM/YYYY. Vamos converter para YYYY-MM-DD
    const parts = dtfDate.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const currentDate = `${year}-${month}-${day}`;
    const currentTime = dtfTime.format(now); // "HH:MM"

    console.log(`[PushService Cron] Checando agendamento. Data atual SP: ${currentDate}, Hora: ${currentTime}`);

    // 3. Verificar Notificação 1
    if (config.notif1_active && config.notif1_status === 'pending') {
      if (config.notif1_date === currentDate && config.notif1_time === currentTime) {
        console.log('[PushService Cron] Disparando Notificação 1 agendada...');
        
        // Bloqueio otimista de concorrência: altera o status para evitar duplicidade
        const { error: lockError } = await supabase
          .from('notifications_config')
          .update({ notif1_status: 'sending', updated_at: new Date().toISOString() })
          .eq('id', 1)
          .eq('notif1_status', 'pending');

        if (!lockError) {
          try {
            const result = await sendPushToAll(config.notif1_title, config.notif1_body);
            await supabase
              .from('notifications_config')
              .update({
                notif1_status: 'sent',
                updated_at: new Date().toISOString()
              })
              .eq('id', 1);
            console.log(`[PushService Cron] Notificação 1 enviada com sucesso para ${result.successCount} aparelhos.`);
          } catch (sendErr: any) {
            await supabase
              .from('notifications_config')
              .update({
                notif1_status: 'failed',
                notif1_error: sendErr.message || 'Erro de envio',
                updated_at: new Date().toISOString()
              })
              .eq('id', 1);
          }
        }
      }
    }

    // 4. Verificar Notificação 2
    if (config.notif2_active && config.notif2_status === 'pending') {
      if (config.notif2_date === currentDate && config.notif2_time === currentTime) {
        console.log('[PushService Cron] Disparando Notificação 2 agendada...');
        
        // Bloqueio otimista de concorrência
        const { error: lockError } = await supabase
          .from('notifications_config')
          .update({ notif2_status: 'sending', updated_at: new Date().toISOString() })
          .eq('id', 1)
          .eq('notif2_status', 'pending');

        if (!lockError) {
          try {
            const result = await sendPushToAll(config.notif2_title, config.notif2_body);
            await supabase
              .from('notifications_config')
              .update({
                notif2_status: 'sent',
                updated_at: new Date().toISOString()
              })
              .eq('id', 1);
            console.log(`[PushService Cron] Notificação 2 enviada com sucesso para ${result.successCount} aparelhos.`);
          } catch (sendErr: any) {
            await supabase
              .from('notifications_config')
              .update({
                notif2_status: 'failed',
                notif2_error: sendErr.message || 'Erro de envio',
                updated_at: new Date().toISOString()
              })
              .eq('id', 1);
          }
        }
      }
    }
  } catch (err) {
    console.error('[PushService Cron] Erro geral ao processar agendamentos:', err);
  }
}
