import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';
import { TtsRelayService } from './tts-relay.service';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

const AsrClient = tencentcloud.asr.v20190614.Client;

@Module({
  controllers: [SpeechController],
  providers: [
    SpeechService,
    TtsRelayService,
    {
      provide: 'ASR_CLIENT',
      useFactory: (configService: ConfigService) => {
        const secretId = configService.get<string>('TENCENT_SECRET_ID', '');
        const secretKey = configService.get<string>('TENCENT_SECRET_KEY', '');
        if (!secretId || !secretKey) {
          return null;
        }
        return new AsrClient({
          credential: { secretId, secretKey },
          region: 'ap-shanghai',
          profile: {
            httpProfile: { reqMethod: 'POST', reqTimeout: 30 },
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [TtsRelayService],
})
export class SpeechModule {}
