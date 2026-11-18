import { randomUUID } from 'node:crypto';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { ENV } from '../config/env';

type MessageHandler = (data: any) => Promise<void>;

/** Parse edilemeyen / işlenemeyen mesajların bırakıldığı kuyruk (inceleme için). */
export const DEAD_LETTER_QUEUE = 'dead_letter_queue';

/** RabbitMQ'nun yerleşik "direct reply-to" sahte kuyruğu (RPC yanıtları için). */
const DIRECT_REPLY_TO = 'amq.rabbitmq.reply-to';

export class RabbitMQService {
  private static instance: RabbitMQService;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumers = new Map<string, MessageHandler>();
  private pendingRequests = new Map<
    string,
    { resolve: (value: any) => void; reject: (reason: Error) => void; timer: NodeJS.Timeout }
  >();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isClosing = false;

  private constructor() {}

  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  public async connect(): Promise<void> {
    try {
      const connection = await amqp.connect(ENV.RABBITMQ.URL);
      const channel = await connection.createChannel();

      // Gerekli kuyrukları tanımla
      await channel.assertQueue(ENV.RABBITMQ.SENSOR_QUEUE, { durable: true });
      await channel.assertQueue(ENV.RABBITMQ.CORE_ENGINE_QUEUE, { durable: true });
      await channel.assertQueue(ENV.RABBITMQ.DECISIONS_QUEUE, { durable: true });
      await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });

      // Aynı anda tek mesaj işle: sıra korunur, DB yazımı geride kalırsa bellek şişmez
      await channel.prefetch(1);

      // RPC yanıtları için "direct reply-to" (ek kuyruk tanımlamaya gerek yok).
      // Bu consumer, istekleri yayınlayan kanalla aynı kanalda olmak zorundadır.
      await channel.consume(
        DIRECT_REPLY_TO,
        (msg) => {
          if (!msg) return;
          const pending = this.pendingRequests.get(msg.properties.correlationId);
          if (!pending) return; // Zaman aşımına uğramış / bilinmeyen yanıt
          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.properties.correlationId);
          try {
            pending.resolve(JSON.parse(msg.content.toString()));
          } catch {
            pending.reject(new Error('Yanıt JSON olarak çözümlenemedi.'));
          }
        },
        { noAck: true }
      );

      this.connection = connection;
      this.channel = channel;

      connection.on('error', (err) => console.error('[RabbitMQ] Bağlantı hatası:', err.message));
      connection.on('close', () => {
        this.connection = null;
        this.channel = null;
        this.rejectAllPending(new Error('RabbitMQ bağlantısı koptu.'));
        if (!this.isClosing) {
          console.warn('[RabbitMQ] Bağlantı koptu, yeniden bağlanılacak...');
          this.scheduleReconnect();
        }
      });

      console.log('[RabbitMQ] Broker bağlantısı kuruldu ve kuyruklar doğrulandı.');

      // Yeniden bağlanma sonrası mevcut consumer'ları tekrar kaydet
      for (const [queueName, handler] of this.consumers) {
        await this.registerConsumer(queueName, handler);
      }
    } catch (error) {
      console.error('[RabbitMQ] Bağlantı hatası:', error);
      throw error;
    }
  }

  /**
   * Bağlantı kopunca/başlangıçta başarısız olunca üstel geri çekilme ile yeniden dener.
   */
  public scheduleReconnect(attempt = 1): void {
    if (this.isClosing || this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect(attempt + 1);
      }
    }, delay);
  }

  /**
   * Kuyruğa mesaj gönderir (Producer)
   * Örn: Spring Boot Core Engine'e veya Socket.io servisine
   */
  public async publishToQueue(queueName: string, message: any): Promise<boolean> {
    if (!this.channel) {
      throw new Error('RabbitMQ kanalı açık değil.');
    }
    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.sendToQueue(queueName, buffer, { persistent: true, contentType: 'application/json' });
  }

  public isConnected(): boolean {
    return this.channel !== null;
  }

  /**
   * İstek-yanıt (RPC): mesajı kuyruğa gönderir ve aynı correlationId ile gelen yanıtı bekler.
   * Örn: Core Engine (Java) simülasyon isteği. Süre dolarsa reddedilir; cevapsız istek kuyrukta
   * birikmesin diye mesaja aynı süre kadar TTL (expiration) konur.
   */
  public request<T = any>(queueName: string, message: unknown, timeoutMs: number): Promise<T> {
    const channel = this.channel;
    if (!channel) {
      return Promise.reject(new Error('RabbitMQ kanalı açık değil.'));
    }

    const correlationId = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`'${queueName}' isteği ${timeoutMs} ms içinde yanıtlanmadı.`));
      }, timeoutMs);

      this.pendingRequests.set(correlationId, { resolve, reject, timer });

      try {
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
          correlationId,
          replyTo: DIRECT_REPLY_TO,
          contentType: 'application/json',
          persistent: false,
          expiration: String(timeoutMs),
        });
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(correlationId);
        reject(err as Error);
      }
    });
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Belirtilen kuyruktan gelen mesajları dinler (Consumer).
   * Handler kaydı saklanır; bağlantı yeniden kurulunca otomatik tekrar abone olunur.
   */
  public async consumeQueue(queueName: string, onMessage: MessageHandler): Promise<void> {
    this.consumers.set(queueName, onMessage);
    // Broker henüz bağlı değilse handler saklanır, bağlantı kurulunca otomatik abone olunur
    if (this.channel) {
      await this.registerConsumer(queueName, onMessage);
    }
  }

  private async registerConsumer(queueName: string, onMessage: MessageHandler): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('RabbitMQ kanalı açık değil.');
    }

    await channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (msg === null) return;

      let content: any;
      try {
        content = JSON.parse(msg.content.toString());
      } catch (err) {
        // Bozuk JSON: tekrar denemenin anlamı yok, inceleme için DLQ'ya taşı
        console.error(`[RabbitMQ] Geçersiz JSON (${queueName}), dead-letter'a taşındı.`);
        this.moveToDeadLetter(channel, queueName, msg, 'INVALID_JSON');
        channel.ack(msg);
        return;
      }

      try {
        await onMessage(content);
        channel.ack(msg);
      } catch (err: any) {
        console.error(`[RabbitMQ] Mesaj işlenirken hata (${queueName}):`, err?.message ?? err);
        this.moveToDeadLetter(channel, queueName, msg, err?.message ?? 'PROCESSING_ERROR');
        channel.ack(msg);
      }
    });

    console.log(`[RabbitMQ] '${queueName}' kuyruğu dinleniyor.`);
  }

  private moveToDeadLetter(channel: Channel, sourceQueue: string, msg: ConsumeMessage, reason: string): void {
    try {
      channel.sendToQueue(DEAD_LETTER_QUEUE, msg.content, {
        persistent: true,
        headers: { 'x-source-queue': sourceQueue, 'x-failure-reason': reason.slice(0, 500) },
      });
    } catch (e) {
      console.error('[RabbitMQ] Dead-letter kuyruğuna yazılamadı:', e);
    }
  }

  public async close(): Promise<void> {
    this.isClosing = true;
    this.rejectAllPending(new Error('RabbitMQ bağlantısı kapatılıyor.'));
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // Bağlantı zaten kapalıysa yoksay
    }
    this.channel = null;
    this.connection = null;
  }
}
