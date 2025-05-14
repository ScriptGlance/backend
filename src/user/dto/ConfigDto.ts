export class ConfigDto {
  words_per_minute_min: number;
  words_per_minute_max: number;
  premium_config: {
    max_free_recording_time_seconds: number;
    max_free_participants_count: number;
    max_free_video_count: number;
    premium_price_cents: number;
  };
}
