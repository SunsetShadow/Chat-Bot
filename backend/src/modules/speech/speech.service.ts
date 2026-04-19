import { Inject, Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

type AsrClient = InstanceType<typeof tencentcloud.asr.v20190614.Client>;

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(
    @Inject('ASR_CLIENT') private readonly asrClient: AsrClient | null,
  ) {}

  async recognizeBySentence(file: { buffer: Buffer }): Promise<string> {
    if (!this.asrClient) {
      throw new ServiceUnavailableException('ASR 服务未配置，请设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY');
    }
    const audioBase64 = file.buffer.toString('base64');
    try {
      const result = await this.asrClient.SentenceRecognition({
        EngSerViceType: '16k_zh',
        SourceType: 1,
        Data: audioBase64,
        DataLen: file.buffer.length,
        VoiceFormat: 'ogg-opus',
      });
      return result.Result ?? '';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error('ASR recognition failed:', msg);
      if (msg.includes('SecretId') || msg.includes('鉴权') || msg.includes('Authorization')) {
        throw new ServiceUnavailableException('ASR 服务鉴权失败，请检查腾讯云密钥配置');
      }
      throw new BadRequestException(`语音识别失败: ${msg}`);
    }
  }
}
