import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
  AudioPlayerStatus,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import ytdl from 'ytdl-core';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { User, getUsers } from './firebase.js';
import { initDiscordClient } from './discord.js';

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
let isPlaying;
let connection;
let stream;
let resource;
let player;

const startMusic = (newState, url, begin, filter, duration) => {
  if (isPlaying) return;
  try {
    connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
    });

    stream = ytdl(url, {
      filter: filter,
      begin: begin,
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
      if (!isPlaying) return;
      endMusic();
    }, duration * 1000);
    isPlaying = true;
  } catch (e) {
    endMusic();
  }
};

const endMusic = () => {
  if (!connection) return;
  connection.destroy();
  isPlaying = false;
};

let users: User[];
client.on(Events.ClientReady, async () => {
  users = await getUsers();
});

client.on('voiceStateUpdate', (oldState, newState) => {
  if (isPlaying || oldState.channelId) return;
  const matchedUser = users.find((u) => u.id === newState.member.id);
  if (!matchedUser) return;
  const { url, startAt, mode, duration } = matchedUser.musicConfig;
  startMusic(newState, url, startAt, mode, duration);
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
