// Reexport the native module. On web, it will be resolved to ExpoSpeechTranscriberModule.web.ts
// and on native platforms to ExpoSpeechTranscriberModule.ts
export { default } from './ExpoSpeechTranscriberModule';
export { default as ExpoSpeechTranscriberView } from './ExpoSpeechTranscriberView';
export * from  './ExpoSpeechTranscriber.types';
