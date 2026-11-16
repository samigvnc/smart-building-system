import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { ENV } from '../config/env';

type MessageHandler = (data: any) => Promise<void>;

/** Parse edilemeyen / işlenemeyen mesajların bırakıldığı kuyruk (inceleme için). */
export const DEAD_LETTER_QUEUE = 'dead_letter_queue';

export class RabbitMQService {
  private static instance: RabbitMQService;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consumers = new Map<string, MessageHandler>();
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

      this.connection = connection;
      this.channel = channel;

      connection.on('error', (err) => console.error('[RabbitMQ] Bağlantı hatası:', err.message));
      connection.on('close', () => {
        this.connection = null;
        this.channel = null;
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
