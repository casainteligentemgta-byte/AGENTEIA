/**
 * AlertManager — umbrales y canales Slack / Email / PagerDuty (opcionales).
 */

import { logger } from '../logging/Logger';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'slack' | 'email' | 'pagerduty';

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  tags: string[];
}

export interface ThresholdMetrics {
  imports_failed_rate?: number;
  latency_seconds?: number;
  memory_percent?: number;
  cache_hit_rate?: number;
}

const SLACK_COLORS: Record<AlertSeverity, string> = {
  critical: 'danger',
  warning: 'warning',
  info: 'good',
};

const PAGERDUTY_SEVERITY: Record<AlertSeverity, string> = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
};

export class AlertManager {
  private readonly channels: AlertChannel[] = [];

  constructor() {
    if (process.env.SLACK_WEBHOOK_URL) this.channels.push('slack');
    if (process.env.SENDGRID_API_KEY) this.channels.push('email');
    if (process.env.PAGERDUTY_KEY) this.channels.push('pagerduty');
  }

  getChannels(): AlertChannel[] {
    return [...this.channels];
  }

  async checkThresholds(metrics: ThresholdMetrics): Promise<Alert[]> {
    const alerts: Alert[] = [];

    if (
      typeof metrics.imports_failed_rate === 'number' &&
      metrics.imports_failed_rate > 0.05
    ) {
      alerts.push(
        this.buildAlert(
          'critical',
          'Alta tasa de fallos de importación',
          `Tasa de fallos ${(metrics.imports_failed_rate * 100).toFixed(1)}% (>5%)`,
          ['imports', 'error-rate'],
        ),
      );
    }

    if (typeof metrics.latency_seconds === 'number' && metrics.latency_seconds > 5) {
      alerts.push(
        this.buildAlert(
          'warning',
          'Latencia elevada',
          `Latencia ${metrics.latency_seconds.toFixed(2)}s (>5s)`,
          ['latency', 'performance'],
        ),
      );
    }

    if (typeof metrics.memory_percent === 'number' && metrics.memory_percent > 90) {
      alerts.push(
        this.buildAlert(
          'critical',
          'Uso de memoria crítico',
          `Memoria al ${metrics.memory_percent.toFixed(1)}% (>90%)`,
          ['memory', 'resources'],
        ),
      );
    }

    if (
      typeof metrics.cache_hit_rate === 'number' &&
      metrics.cache_hit_rate < 0.5
    ) {
      alerts.push(
        this.buildAlert(
          'warning',
          'Cache hit rate bajo',
          `Hit rate ${(metrics.cache_hit_rate * 100).toFixed(1)}% (<50%)`,
          ['cache'],
        ),
      );
    }

    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    return alerts;
  }

  async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      try {
        if (channel === 'slack') await this.sendSlack(alert);
        if (channel === 'email') await this.sendEmail(alert);
        if (channel === 'pagerduty') await this.sendPagerDuty(alert);
      } catch (err) {
        logger.error(
          `Fallo enviando alerta por ${channel}`,
          err instanceof Error ? err : new Error(String(err)),
          { title: alert.title },
        );
      }
    }

    logger.warn('Alert enviada', {
      severity: alert.severity,
      title: alert.title,
      channels: this.channels,
      tags: alert.tags,
    });
  }

  async sendSlack(alert: Alert): Promise<void> {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return;

    const body = {
      attachments: [
        {
          color: SLACK_COLORS[alert.severity],
          title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          text: alert.message,
          ts: Math.floor(alert.timestamp.getTime() / 1000),
          fields: alert.tags.map((t) => ({ title: 'tag', value: t, short: true })),
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Slack webhook HTTP ${res.status}`);
    }
  }

  async sendEmail(alert: Alert): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    const to = process.env.ON_CALL_EMAIL;
    if (!apiKey || !to) return;

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.ALERT_FROM_EMAIL || 'alerts@smartimport.local' },
        subject: `[SmartImport][${alert.severity}] ${alert.title}`,
        content: [{ type: 'text/plain', value: alert.message }],
      }),
    });

    if (!res.ok) {
      throw new Error(`SendGrid HTTP ${res.status}`);
    }
  }

  async sendPagerDuty(alert: Alert): Promise<void> {
    const routingKey = process.env.PAGERDUTY_KEY;
    if (!routingKey) return;

    const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'trigger',
        payload: {
          summary: alert.title,
          source: 'smartimport',
          severity: PAGERDUTY_SEVERITY[alert.severity],
          custom_details: {
            message: alert.message,
            tags: alert.tags,
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`PagerDuty HTTP ${res.status}`);
    }
  }

  private buildAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    tags: string[],
  ): Alert {
    return {
      severity,
      title,
      message,
      timestamp: new Date(),
      tags,
    };
  }
}

export const alertManager = new AlertManager();
