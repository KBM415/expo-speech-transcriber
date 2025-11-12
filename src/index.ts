// Reexport the native module. On web, it will be resolved to ExpoSpeechTranscriberModule.web.ts
// and on native platforms to ExpoSpeechTranscriberModule.ts
import ExpoSpeechTranscriberModule from './ExpoSpeechTranscriberModule';

export * from './ExpoSpeechTranscriber.types';

export function transcribeAudio(audioFilePath: string): Promise<string> {
  return ExpoSpeechTranscriberModule.transcribeAudio(audioFilePath);
}

export function requestPermissions(): Promise<string> {
  return ExpoSpeechTranscriberModule.requestPermissions();
}
