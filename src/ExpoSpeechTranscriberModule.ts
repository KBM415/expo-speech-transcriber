import { NativeModule, requireNativeModule } from 'expo';

import { ExpoSpeechTranscriberModuleEvents } from './ExpoSpeechTranscriber.types';

declare class ExpoSpeechTranscriberModule extends NativeModule<ExpoSpeechTranscriberModuleEvents> {
  transcribeAudio(audioFilePath: string): Promise<string>;
  requestPermissions(): Promise<string>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoSpeechTranscriberModule>('ExpoSpeechTranscriber');
