import 'dotenv/config';
import { Client, GatewayIntentBits, Events, VoiceState } from 'discord.js';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  StreamType,
  VoiceConnection,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import ytdl from 'ytdl-core';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initDiscordClient } from './discord.js';
import { Readable } from 'stream';
import { MusicConfig } from './models/MusicConfig.js';
import { User, getUsers } from './models/User.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

initializeApp({
  credential: applicationDefault(),
});

export const db = getFirestore();

// the world's most advanced state machine
let isPlaying: boolean;
let connection: VoiceConnection;
let stream: Readable;
let resource: AudioResource;
let player: AudioPlayer;

const endMusic = () => {
  if (!connection) return;
  player.stop();
  isPlaying = false;
  connection.destroy();
};

const startMusic = ({ guild, channel, channelId }: VoiceState, config: MusicConfig) => {
  if (isPlaying) return;
  try {
    connection = joinVoiceChannel({
      adapterCreator: channel.guild.voiceAdapterCreator,
      channelId: channelId,
      guildId: guild.id,
    });
    const { url } = config;
    stream = ytdl(url, {
      filter: 'audioonly',
    });
    resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });

    player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      endMusic();
    });

    setTimeout(() => {
      // if (!isPlaying) return;
      endMusic();
    }, 10 * 1000);
    isPlaying = true;
  } catch (e) {
    console.log(e);
    endMusic();
  }
};

let users: User[];
client.on(Events.ClientReady, async () => {
  users = await getUsers();
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (isPlaying || oldState.channelId) return;
  console.log('member ID: ' + newState.member.id);
  console.log('ID: ' + newState.id);
  const matchedUser = users.find((u) => u.id === newState.member.id);
  if (!matchedUser) return;
  startMusic(newState, matchedUser.musicConfig);
});

client.on('messageCreate', (m) => {
  if (m.mentions.has(client.user)) {
    if (!isPlaying) return;
    endMusic();
    m.reply('You got it chief.');
    isPlaying = false;
  }
});

await initDiscordClient(client);
