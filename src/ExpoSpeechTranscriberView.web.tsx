import * as React from 'react';

import { ExpoSpeechTranscriberViewProps } from './ExpoSpeechTranscriber.types';

export default function ExpoSpeechTranscriberView(props: ExpoSpeechTranscriberViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
