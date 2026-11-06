import { PushTokensRepo } from "../db/repositories/pushTokens.repo";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushResponse = {
  data?: Array<{ status?: string; details?: { error?: string } }>;
};

export async function sendAlertPush(
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  const repo = new PushTokensRepo();
  const tokens = repo.all();
  if (!tokens.length) return;

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      tokens.map(({ token }) => ({
        to: token,
        title,
        body,
        data,
        sound: "default",
      })),
    ),
  });

  if (!response.ok) {
    throw new Error(`Expo push service returned HTTP ${response.status}`);
  }

  const result = (await response.json()) as ExpoPushResponse;
  result.data?.forEach((ticket, index) => {
    if (ticket.details?.error === "DeviceNotRegistered") {
      repo.delete(tokens[index].token);
    }
  });
}
