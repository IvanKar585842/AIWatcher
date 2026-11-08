export interface AlertChannelStatus {
  channel: "in_app" | "email" | "telegram" | "webhook";
  ready: boolean;
  detail: string;
}

export function describeAlertChannels(input: {
  resendConfigured: boolean;
  hasEmail: boolean;
  emailEnabled: boolean;
  telegramTokenConfigured: boolean;
  telegramConnected: boolean;
  telegramEnabled: boolean;
  planAllowsTelegram: boolean;
  webhookConfigured: boolean;
  planAllowsWebhook: boolean;
}): AlertChannelStatus[] {
  return [
    {
      channel: "in_app",
      ready: true,
      detail: "Saved in the notification center for this account.",
    },
    {
      channel: "email",
      ready: input.resendConfigured && input.hasEmail && input.emailEnabled,
      detail: !input.resendConfigured
        ? "Email sending is not configured on the server."
        : !input.hasEmail
          ? "This account has no email address."
          : input.emailEnabled
            ? "Email can be sent when a monitor asks for it."
            : "Email alerts are turned off.",
    },
    {
      channel: "telegram",
      ready:
        input.planAllowsTelegram &&
        input.telegramTokenConfigured &&
        input.telegramConnected &&
        input.telegramEnabled,
      detail: !input.planAllowsTelegram
        ? "Telegram is included on Pro and Business."
        : !input.telegramTokenConfigured
          ? "The Telegram bot token is not configured on the server."
          : !input.telegramConnected
            ? "Connect Telegram in settings before alerts can be delivered there."
            : input.telegramEnabled
              ? "Telegram can be sent when a monitor asks for it."
              : "Telegram alerts are turned off.",
    },
    {
      channel: "webhook",
      ready: input.planAllowsWebhook && input.webhookConfigured,
      detail: !input.planAllowsWebhook
        ? "Signed webhooks are included on Business."
        : input.webhookConfigured
          ? "A change posts signed JSON to the saved HTTPS endpoint."
          : "No webhook endpoint is saved.",
    },
  ];
}
