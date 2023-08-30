import { Filter } from 'ytdl-core';

export interface MusicConfig {
  duration: number;
  filter: Filter;
  startAt: string;
  url: string;
}
