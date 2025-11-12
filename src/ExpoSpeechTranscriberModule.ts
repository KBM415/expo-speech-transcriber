import { NativeModule, requireNativeModule } from 'expo';

import { ExpoSpeechTranscriberModuleEvents } from './ExpoSpeechTranscriber.types';

declare class ExpoSpeechTranscriberModule extends NativeModule<ExpoSpeechTranscriberModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoSpeechTranscriberModule>('ExpoSpeechTranscriber');
