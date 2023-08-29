import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Client } from 'discord.js';

export const initDiscordClient = async (client: Client) => {
  const secretMgrClient = new SecretManagerServiceClient();
  const [accessResponse] = await secretMgrClient.accessSecretVersion({
    name: 'projects/458748230359/secrets/DISCORD_TOKEN/versions/latest',
  });
  const token = accessResponse.payload?.data?.toString();
  if (!token) {
    throw new Error('Discord token not provided.');
  }

  await client.login(token);
  console.log('started');
};
