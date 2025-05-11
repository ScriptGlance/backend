import { Injectable } from '@nestjs/common';
import { StandardResponse } from '../common/interface/StandardResponse';
import { ConfigDto } from './dto/ConfigDto';
import {
  FREE_VIDEOS_PER_PRESENTATION,
  MAX_FREE_PARTICIPANTS_COUNT,
  MAX_FREE_RECORDING_TIME_SECONDS,
  PREMIUM_PRICE_CENTS,
  WORDS_PER_MINUTE_MAX,
  WORDS_PER_MINUTE_MIN,
} from '../common/Constants';

@Injectable()
export class UserService {
  getConfig(): StandardResponse<ConfigDto> {
    return {
      data: {
        words_per_minute_min: WORDS_PER_MINUTE_MIN,
        words_per_minute_max: WORDS_PER_MINUTE_MAX,
        premium_config: {
          max_free_recording_time_seconds: MAX_FREE_RECORDING_TIME_SECONDS,
          max_free_participants_count: MAX_FREE_PARTICIPANTS_COUNT,
          max_free_video_count: FREE_VIDEOS_PER_PRESENTATION,
          premium_price_cents: PREMIUM_PRICE_CENTS,
        },
      },
      error: false,
    };
  }
}
