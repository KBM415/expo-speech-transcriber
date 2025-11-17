import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SpeechTranscriber from 'expo-speech-transcriber';
import {
  AudioContext,
  AudioManager,
  AudioRecorder,
  RecorderAdapterNode,
} from 'react-native-audio-api';

const SAMPLE_RATE = 16000;

const App = () => {
  const [transcription, setTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [ready, setReady] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderAdapterRef = useRef<RecorderAdapterNode | null>(null);
  const busyRef = useRef(false);
  const aggRef = useRef<Float32Array[]>([]);
  const aggLenRef = useRef(0);

  const AGG_TARGET = SAMPLE_RATE; // ~1 second chunks

  useEffect(() => {
    (async () => {
      try {
        // Request microphone permissions
        await AudioManager.requestRecordingPermissions();
        
        // Request speech recognition permissions
        const speechPermission = await SpeechTranscriber.requestPermissions();
        if (speechPermission !== 'authorized') {
          Alert.alert('Permission Required', 'Speech recognition permission is needed.');
          return;
        }

        // Initialize recorder
        recorderRef.current = new AudioRecorder({
          sampleRate: SAMPLE_RATE,
          bufferLengthInSamples: SAMPLE_RATE,
        });

        console.log('AudioRecorder initialized with sample rate:', SAMPLE_RATE);
        setReady(true);
      } catch (error) {
        console.error('Setup error:', error);
        Alert.alert('Error', 'Failed to initialize audio system');
      }
    })();

    return () => {
      stopRecording();
      audioContextRef.current?.close();
    };
  }, []);

  const startRecording = async () => {
    if (!recorderRef.current) {
      Alert.alert('Error', 'Recorder not initialized');
      return;
    }

    try {
      setTranscription('');
      aggRef.current = [];
      aggLenRef.current = 0;

      // Configure audio session for recording
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'spokenAudio',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
      });

      // Create audio context and recorder adapter
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      recorderAdapterRef.current = audioContextRef.current.createRecorderAdapter();
      recorderAdapterRef.current.connect(audioContextRef.current.destination);
      recorderRef.current.connect(recorderAdapterRef.current);

      // Set up audio buffer callback
      recorderRef.current.onAudioReady(async (event) => {
        const { buffer } = event;
        const pcm = buffer.getChannelData(0); // Float32Array directly

        aggRef.current.push(pcm);
        aggLenRef.current += pcm.length;

        if (aggLenRef.current < AGG_TARGET || busyRef.current) return;

        // Merge into single Float32Array
        const merged = new Float32Array(aggLenRef.current);
        let offset = 0;
        for (const part of aggRef.current) {
          merged.set(part, offset);
          offset += part.length;
        }
        aggRef.current = [];
        aggLenRef.current = 0;

        busyRef.current = true;
        try {
          console.log('[App] Calling transcribeAudioWithBuffer with Float32Array...');
          const result = await SpeechTranscriber.transcribeAudioWithBuffer(
            merged, // Float32Array directly, no conversion
            SAMPLE_RATE,
            1
          );
          console.log('[App] Result received:', result);

          if (result.error) {
            console.error('[App] Transcription error:', result.error);
          } else if (result.finalText) {
            setTranscription((prev) => (prev ? prev + ' ' + result.finalText : result.finalText));
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error('[App] Exception caught:', errMsg);
        } finally {
          busyRef.current = false;
        }
      });

      // Start recording
      recorderRef.current.start();
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setIsRecording(true);
      console.log('Recording started with live transcription');
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = () => {
    try {
      if (recorderRef.current) {
        recorderRef.current.stop();
        console.log('Recording stopped');
      }

      if (recorderAdapterRef.current) {
        recorderAdapterRef.current.disconnect();
        recorderAdapterRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current = null;
      }

      // Reset audio session
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playback',
        iosMode: 'default',
      });

      aggRef.current = [];
      aggLenRef.current = 0;
      busyRef.current = false;

      setIsRecording(false);
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const testRandomBuffer = async () => {
    console.log('[TEST] Generating random Float32Array...');
    const testBuffer = new Float32Array(16000); // 1 second at 16kHz

    // Fill with random noise between -1 and 1
    for (let i = 0; i < testBuffer.length; i++) {
      testBuffer[i] = Math.random() * 2 - 1;
    }

    console.log('[TEST] Random buffer created:', {
      length: testBuffer.length,
      firstSamples: Array.from(testBuffer.slice(0, 5)),
      type: testBuffer.constructor.name,
    });

    try {
      console.log('[TEST] Calling transcribeAudioWithBuffer with random Float32Array...');
      const result = await SpeechTranscriber.transcribeAudioWithBuffer(
        testBuffer, // Float32Array directly
        16000,
        1
      );
      console.log('[TEST] Result:', result);
      Alert.alert('Test Result', JSON.stringify(result, null, 2));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[TEST] Error:', errMsg);
      Alert.alert('Test Error', errMsg);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Live Transcription</Text>
      <Text style={styles.subtitle}>
        {ready ? `Sample Rate: ${SAMPLE_RATE}Hz` : 'Initializing...'}
      </Text>

      <TouchableOpacity
        onPress={testRandomBuffer}
        style={[styles.button, { backgroundColor: '#f59e0b' }]}
      >
        <Ionicons name="flask" size={24} color="#FFF" />
        <Text style={styles.buttonText}>Test Random Buffer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={startRecording}
        disabled={!ready || isRecording}
        style={[
          styles.button,
          styles.recordButton,
          (!ready || isRecording) && styles.disabled,
        ]}
      >
        <Ionicons name="mic" size={24} color="#FFF" />
        <Text style={styles.buttonText}>Start Recording</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={stopRecording}
        disabled={!isRecording}
        style={[styles.button, styles.stopButton, !isRecording && styles.disabled]}
      >
        <Ionicons name="stop-circle" size={24} color="#FFF" />
        <Text style={styles.buttonText}>Stop Recording</Text>
      </TouchableOpacity>

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <Ionicons name="radio-button-on" size={20} color="#dc3545" />
          <Text style={styles.recordingText}>Recording...</Text>
        </View>
      )}

      {transcription && (
        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionTitle}>Transcription:</Text>
          <Text style={styles.transcriptionText}>{transcription}</Text>
        </View>
      )}

      {!isRecording && !transcription && (
        <Text style={styles.hintText}>
          Press "Start Recording" to begin live transcription
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 8,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordButton: {
    backgroundColor: '#007bff',
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  disabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingText: {
    fontSize: 16,
    color: '#dc3545',
    marginLeft: 10,
    fontWeight: '600',
  },
  transcriptionContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  transcriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  hintText: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default App;