// Reexport the native module. On web, it will be resolved to ExpoSpeechTranscriberModule.web.ts
// and on native platforms to ExpoSpeechTranscriberModule.ts
import ExpoSpeechTranscriberModule from './ExpoSpeechTranscriberModule';
import type {
  TranscriptionProgressPayload,
  TranscriptionErrorPayload,
} from './ExpoSpeechTranscriber.types';

export type TranscriptionResult = {
  text: string;
  finalText: string | null;
  isFinal: boolean;
  error?: string;
};

export async function transcribeAudioWithBuffer(
  audioData: Float32Array,
  sampleRate: number,
  channels: number
): Promise<TranscriptionResult> {
  console.log('[transcribeAudioWithBuffer] Called with:', {
    bufferLength: audioData.length,
    sampleRate,
    channels,
    bufferType: audioData.constructor.name,
  });

  if (!ExpoSpeechTranscriberModule) {
    console.error('[transcribeAudioWithBuffer] Module not loaded!');
    return {
      text: '',
      finalText: null,
      isFinal: false,
      error: 'Native module not loaded',
    };
  }

  if (typeof ExpoSpeechTranscriberModule.transcribeAudioBuffer !== 'function') {
    console.error('[transcribeAudioWithBuffer] Method not found!');
    return {
      text: '',
      finalText: null,
      isFinal: false,
      error: 'transcribeAudioBuffer method not found',
    };
  }

  console.log('[transcribeAudioWithBuffer] Module check passed, setting up listeners...');

  let latestText = '';
  let errorMessage = '';

  const progressSubscription = ExpoSpeechTranscriberModule.addListener(
    'onTranscriptionProgress',
    (event: TranscriptionProgressPayload) => {
      latestText = event.text;
      console.log('[progress]', latestText);
    }
  );

  const errorSubscription = ExpoSpeechTranscriberModule.addListener(
    'onTranscriptionError',
    (event: TranscriptionErrorPayload) => {
      errorMessage = event.error;
      console.error('[error event]', event.error);
    }
  );

  console.log('[transcribeAudioWithBuffer] Listeners attached');

  try {
    console.log('[transcribeAudioWithBuffer] Calling native with Float32Array directly');
    
    const result = await ExpoSpeechTranscriberModule.transcribeAudioBuffer(
      audioData,
      sampleRate,
      channels
    );

    console.log('[transcribeAudioWithBuffer] Native result:', result);

    return {
      text: latestText || result,
      finalText: result,
      isFinal: true,
      error: errorMessage || undefined,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[transcribeAudioWithBuffer] Exception caught:', {
      error: errMsg,
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    });

    return {
      text: '',
      finalText: null,
      isFinal: false,
      error: errMsg,
    };
  } finally {
    console.log('[transcribeAudioWithBuffer] Cleaning up listeners');
    try {
      progressSubscription.remove();
      errorSubscription.remove();
    } catch (cleanupError) {
      console.error('[transcribeAudioWithBuffer] Error removing listeners:', cleanupError);
    }
  }
}

export { default as ExpoSpeechTranscriberModule } from './ExpoSpeechTranscriberModule';
export * from './ExpoSpeechTranscriber.types';

export function transcribeAudioWithSFRecognizer(audioFilePath: string): Promise<string> {
  console.log('[transcribeAudioWithSFRecognizer] Called with:', audioFilePath);
  return ExpoSpeechTranscriberModule.transcribeAudioWithSFRecognizer(audioFilePath);
}

export function transcribeAudioWithAnalyzer(audioFilePath: string): Promise<string> {
  console.log('[transcribeAudioWithAnalyzer] Called with:', audioFilePath);
  return ExpoSpeechTranscriberModule.transcribeAudioWithAnalyzer(audioFilePath);
}

export function requestPermissions(): Promise<string> {
  console.log('[requestPermissions] Called');
  return ExpoSpeechTranscriberModule.requestPermissions();
}

export function isAnalyzerAvailable(): boolean {
  const available = ExpoSpeechTranscriberModule.isAnalyzerAvailable();
  console.log('[isAnalyzerAvailable]', available);
  return available;
}
