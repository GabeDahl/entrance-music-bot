import { Filter } from 'ytdl-core';

export interface MusicConfig {
  duration: string;
  lastSetBy: string;
  filter: Filter;
  startAt: string;
  url: string;
}
