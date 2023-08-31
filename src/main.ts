import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  VoiceState,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
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
import { User, getUser, getUsers, setUser } from './models/User.js';

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

let users: User[];
client.on(Events.ClientReady, async () => {
  users = await getUsers();
});

const endMusic = (): void => {
  if (connection) connection.destroy();
  if (player) player.stop();
  isPlaying = false;
};

const startMusic = (
  { guild, channel, channelId }: VoiceState,
  config: MusicConfig,
): void => {
  if (isPlaying) return;
  try {
    connection = joinVoiceChannel({
      adapterCreator: channel.guild.voiceAdapterCreator,
      channelId: channelId,
      guildId: guild.id,
    });
    const { url, startAt, duration, filter } = config;
    stream = ytdl(url, {
      filter: filter,
      begin: startAt || null,
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
    }, duration * 1000);
    isPlaying = true;
  } catch (e) {
    console.log(e);
    endMusic();
  }
};

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (isPlaying || oldState.channelId) return;
  console.log('member ID: ' + newState.member.id);
  console.log('ID: ' + newState.id);
  const matchedUser = users.find((u) => u.id === newState.member.id);
  if (!matchedUser) return;
  const updatedUser = await getUser(newState.member.id);
  if (!updatedUser) return;
  startMusic(newState, updatedUser.musicConfig);
});

client.on(Events.MessageCreate, (m) => {
  if (m.mentions.has(client.user)) {
    if (!isPlaying) return;
    endMusic();
    m.reply('You got it chief.');
    isPlaying = false;
  }
});

enum InputIds {
  URL = 'urlInput',
  DURATION = 'durationInput',
  START_AT = 'startAtInput',
  FILTER = 'filterInput',
}
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'change-music') {
    const modal = new ModalBuilder()
      .setCustomId('changeMusicModal')
      .setTitle('Change Music');

    const urlInput = new TextInputBuilder()
      .setCustomId(InputIds.URL)
      .setLabel('YouTube URL')
      .setStyle(TextInputStyle.Short);

    const durationInput = new TextInputBuilder()
      .setCustomId(InputIds.DURATION)
      .setLabel('Duration (seconds)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('5');
    const startAtInput = new TextInputBuilder()
      .setCustomId(InputIds.START_AT)
      .setLabel('Start at *UNRELIABLE*')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('Format: 1m45s or 1:45');

    const filterInput = new TextInputBuilder()
      .setCustomId(InputIds.FILTER)
      .setLabel('Filter')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('audio | audioandvideo');

    Array.from([urlInput, durationInput, startAtInput, filterInput]).forEach(
      (input) => {
        const actionRow =
          new ActionRowBuilder<TextInputBuilder>().addComponents(input);
        modal.addComponents(actionRow);
      },
    );
    await interaction.showModal(modal);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  const url = interaction.fields.getTextInputValue(InputIds.URL);
  const durationStr = interaction.fields.getTextInputValue(InputIds.DURATION);
  const startAt = interaction.fields.getTextInputValue(InputIds.START_AT);
  const filterStr = interaction.fields.getTextInputValue(InputIds.FILTER);

  // // convert and validate
  const duration = durationStr ? parseInt(durationStr) : 5;
  const filter =
    filterStr === 'audio' || filterStr === 'audioandvideo'
      ? filterStr
      : 'audioandvideo';
  const config: MusicConfig = {
    url,
    startAt,
    duration,
    filter,
  };
  console.log(config);
  await setUser({ id: interaction.user.id, musicConfig: config });
  interaction.reply({
    ephemeral: true,
    content: 'Success',
  });
});

await initDiscordClient(client);
