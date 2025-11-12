import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoSpeechTranscriberViewProps } from './ExpoSpeechTranscriber.types';

const NativeView: React.ComponentType<ExpoSpeechTranscriberViewProps> =
  requireNativeView('ExpoSpeechTranscriber');

export default function ExpoSpeechTranscriberView(props: ExpoSpeechTranscriberViewProps) {
  return <NativeView {...props} />;
}
