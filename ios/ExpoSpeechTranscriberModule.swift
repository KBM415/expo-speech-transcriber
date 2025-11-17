import ExpoModulesCore
import Speech
import AVFoundation

public class ExpoSpeechTranscriberModule: Module {
  
  public func definition() -> ModuleDefinition {
    Name("ExpoSpeechTranscriber")
    
    Events("onTranscriptionProgress", "onTranscriptionError")
    
    OnCreate {
      print("[ExpoSpeechTranscriber] Module created")
    }
    
    // Method 1: Transcribe from Float32Array buffer using SFSpeechRecognizer
    AsyncFunction("transcribeAudioBuffer") { (audioData: [Float32], sampleRate: Double, channels: Int) async -> String in
      print("[transcribeAudioBuffer] === NATIVE METHOD ENTERED ===")
      print("[transcribeAudioBuffer] Called - samples: \(audioData.count), sr: \(sampleRate), ch: \(channels)")
      
      // Validate input
      print("[transcribeAudioBuffer] Step 1: Validating input...")
      guard !audioData.isEmpty else {
        let err = "Error: Empty audio data"
        print("[transcribeAudioBuffer] \(err)")
        self.sendEvent("onTranscriptionError", ["error": err])
        return err
      }
      print("[transcribeAudioBuffer] Step 1a: Array not empty, count = \(audioData.count)")
      
      guard channels > 0 && channels <= 2 else {
        let err = "Error: Invalid channel count (must be 1 or 2)"
        print("[transcribeAudioBuffer] \(err)")
        self.sendEvent("onTranscriptionError", ["error": err])
        return err
      }
      print("[transcribeAudioBuffer] Step 1b: Channels valid = \(channels)")
      
      print("[transcribeAudioBuffer] Step 2: Creating audio format...")
      // Create audio format
      guard let format = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: sampleRate,
        channels: AVAudioChannelCount(channels),
        interleaved: false
      ) else {
        let err = "Error: Could not create audio format"
        print("[transcribeAudioBuffer] \(err)")
        self.sendEvent("onTranscriptionError", ["error": err])
        return err
      }
      print("[transcribeAudioBuffer] Step 2: Audio format created successfully")
      
      print("[transcribeAudioBuffer] Step 3: Calculating frame count...")
      // Calculate frame count
      let frameCount = AVAudioFrameCount(audioData.count / channels)
      guard frameCount > 0 else {
        let err = "Error: Invalid frame count"
        print("[transcribeAudioBuffer] \(err)")
        self.sendEvent("onTranscriptionError", ["error": err])
        return err
      }
      print("[transcribeAudioBuffer] Step 3: Frame count = \(frameCount)")
      
      print("[transcribeAudioBuffer] Step 4: Creating PCM buffer...")
      // Create buffer
      guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else {
        let err = "Error: Could not create audio buffer"
        print("[transcribeAudioBuffer] \(err)")
        self.sendEvent("onTranscriptionError", ["error": err])
        return err
      }
      buffer.frameLength = frameCount
      print("[transcribeAudioBuffer] Step 4: PCM buffer created, frameLength set")
      
      print("[transcribeAudioBuffer] Step 5: Getting channel data pointer...")
      // Copy audio data
      guard let channelData = buffer.floatChannelData else {
        let err = "Error: Could not access buffer channel data"
        print("[transcribeAudioBuffer] \(err)")
        self.sendEvent("onTranscriptionError", ["error": err])
        return err
      }
      print("[transcribeAudioBuffer] Step 5: Channel data pointer obtained")
      
      print("[transcribeAudioBuffer] Step 6: Copying audio data...")
      audioData.withUnsafeBufferPointer { ptr in
        guard let baseAddress = ptr.baseAddress else {
          print("[transcribeAudioBuffer] ERROR: Could not get base address")
          return
        }
        print("[transcribeAudioBuffer] Step 6a: Base address obtained")
        
        if channels == 1 {
          print("[transcribeAudioBuffer] Step 6b: Copying mono data via memcpy...")
          memcpy(channelData[0], baseAddress, audioData.count * MemoryLayout<Float32>.stride)
          print("[transcribeAudioBuffer] Step 6b: Mono audio data copied successfully")
        } else {
          print("[transcribeAudioBuffer] Step 6b: Copying stereo data via loop...")
          for frame in 0..<Int(frameCount) {
            for channel in 0..<channels {
              channelData[channel][frame] = baseAddress[frame * channels + channel]
            }
          }
          print("[transcribeAudioBuffer] Step 6b: Stereo audio data copied successfully")
        }
      }
      
      print("[transcribeAudioBuffer] Step 7: Calling internal transcribeAudioBuffer...")
      let result = await self.transcribeAudioBuffer(buffer: buffer)
      
      print("[transcribeAudioBuffer] Step 8: Received result from internal method")
      let preview = result.prefix(50)
      print("[transcribeAudioBuffer] === NATIVE METHOD EXITING === Result: \(preview)...")
      return result
    }
    
    // Method 2: Transcribe from URL using SFSpeechRecognizer
    AsyncFunction("transcribeAudioWithSFRecognizer") { (audioFilePath: String) async throws -> String in
      print("[transcribeAudioWithSFRecognizer] Called with: \(audioFilePath)")
      
      let url: URL
      if audioFilePath.hasPrefix("file://") {
        url = URL(string: audioFilePath)!
      } else {
        url = URL(fileURLWithPath: audioFilePath)
      }
      
      print("[transcribeAudioWithSFRecognizer] Processing audio file at: \(url.path)")
      let transcription = await self.transcribeAudio(url: url)
      print("[transcribeAudioWithSFRecognizer] Result: \(transcription)")
      return transcription
    }
    
    // Method 3: Transcribe from URL using SpeechAnalyzer (iOS 26+)
    AsyncFunction("transcribeAudioWithAnalyzer") { (audioFilePath: String) async throws -> String in
      print("[transcribeAudioWithAnalyzer] Called with: \(audioFilePath)")
      
      if #available(iOS 26.0, *) {
        let url: URL
        if audioFilePath.hasPrefix("file://") {
          url = URL(string: audioFilePath)!
        } else {
          url = URL(fileURLWithPath: audioFilePath)
        }
        
        print("[transcribeAudioWithAnalyzer] Processing audio file at: \(url.path)")
        let transcription = try await self.transcribeAudioWithAnalyzer(url: url)
        print("[transcribeAudioWithAnalyzer] Result: \(transcription)")
        return transcription
      } else {
        throw NSError(domain: "ExpoSpeechTranscriber", code: 501,
                     userInfo: [NSLocalizedDescriptionKey: "SpeechAnalyzer requires iOS 26.0 or later"])
      }
    }
    
    AsyncFunction("requestPermissions") { () async -> String in
      return await self.requestTranscribePermissions()
    }
    
    Function("isAnalyzerAvailable") { () -> Bool in
      if #available(iOS 26.0, *) {
        return true
      }
      return false
    }
  }
  
  // MARK: - Private Implementation Methods
  
  // Implementation for buffer transcription
  private func transcribeAudioBuffer(buffer: AVAudioPCMBuffer) async -> String {
    print("[transcribeAudioBuffer:internal] === INTERNAL METHOD ENTERED ===")
    print("[transcribeAudioBuffer:internal] Buffer frameLength: \(buffer.frameLength), format: \(buffer.format)")
    
    print("[transcribeAudioBuffer:internal] Step 1: Getting recognizer...")
    guard let recognizer = SFSpeechRecognizer() else {
      let err = "Error: Speech recognizer not available for current locale"
      print("[transcribeAudioBuffer:internal] \(err)")
      self.sendEvent("onTranscriptionError", ["error": err])
      return err
    }
    print("[transcribeAudioBuffer:internal] Step 1: Recognizer obtained")
    
    print("[transcribeAudioBuffer:internal] Step 2: Checking availability...")
    guard recognizer.isAvailable else {
      let err = "Error: Speech recognizer not available at this time"
      print("[transcribeAudioBuffer:internal] \(err)")
      self.sendEvent("onTranscriptionError", ["error": err])
      return err
    }
    print("[transcribeAudioBuffer:internal] Step 2: Recognizer is available")
    
    print("[transcribeAudioBuffer:internal] Creating recognition request...")
    return await withCheckedContinuation { continuation in
      let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
      recognitionRequest.shouldReportPartialResults = true
      
      print("[transcribeAudioBuffer:internal] Appending buffer to recognition request")
      recognitionRequest.append(buffer)
      recognitionRequest.endAudio()
      
      var finalTranscription = ""
      
      print("[transcribeAudioBuffer:internal] Starting recognition task...")
      recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
        guard let self = self else {
          print("[transcribeAudioBuffer:internal] Self is nil in recognition callback")
          return
        }
        
        if let error = error {
          let errorMsg = "Error: \(error.localizedDescription)"
          print("[transcribeAudioBuffer:internal] Recognition error: \(errorMsg)")
          self.sendEvent("onTranscriptionError", ["error": errorMsg])
          continuation.resume(returning: errorMsg)
          return
        }
        
        guard let result = result else {
          let errorMsg = "Error: No transcription available"
          print("[transcribeAudioBuffer:internal] \(errorMsg)")
          self.sendEvent("onTranscriptionError", ["error": errorMsg])
          continuation.resume(returning: errorMsg)
          return
        }
        
        let liveText = result.bestTranscription.formattedString
        finalTranscription = liveText
        
        let preview = liveText.prefix(30)
        print("[transcribeAudioBuffer:internal] Partial result: \(preview)... (isFinal: \(result.isFinal))")
        
        self.sendEvent("onTranscriptionProgress", [
          "text": liveText,
          "isFinal": result.isFinal
        ])
        
        if result.isFinal {
          let finalResult = liveText.isEmpty ? "No speech detected" : liveText
          print("[transcribeAudioBuffer:internal] Final transcription: \(finalResult)")
          continuation.resume(returning: finalResult)
        }
      }
    }
  }
  
  // Implementation for URL transcription with SFSpeechRecognizer
  private func transcribeAudio(url: URL) async -> String {
    print("[transcribeAudio] Called with URL: \(url.path)")
    
    guard FileManager.default.fileExists(atPath: url.path) else {
      let err = "Error: Audio file not found at \(url.path)"
      print("[transcribeAudio] \(err)")
      return err
    }
    
    return await withCheckedContinuation { continuation in
      guard let recognizer = SFSpeechRecognizer() else {
        let err = "Error: Speech recognizer not available for current locale"
        print("[transcribeAudio] \(err)")
        continuation.resume(returning: err)
        return
      }
      
      guard recognizer.isAvailable else {
        let err = "Error: Speech recognizer not available at this time"
        print("[transcribeAudio] \(err)")
        continuation.resume(returning: err)
        return
      }
      
      print("[transcribeAudio] Recognizer available, creating request")
      let request = SFSpeechURLRecognitionRequest(url: url)
      request.shouldReportPartialResults = false
      
      print("[transcribeAudio] Starting recognition task...")
      recognizer.recognitionTask(with: request) { (result, error) in
        if let error = error {
          let errorMsg = "Error: \(error.localizedDescription)"
          print("[transcribeAudio] Recognition error: \(errorMsg)")
          continuation.resume(returning: errorMsg)
          return
        }
        
        guard let result = result else {
          let errorMsg = "Error: No transcription available"
          print("[transcribeAudio] \(errorMsg)")
          continuation.resume(returning: errorMsg)
          return
        }
        
        if result.isFinal {
          let text = result.bestTranscription.formattedString
          let finalResult = text.isEmpty ? "No speech detected" : text
          print("[transcribeAudio] Final result: \(finalResult)")
          continuation.resume(returning: finalResult)
        }
      }
    }
  }
  
  // Implementation for URL transcription with SpeechAnalyzer (iOS 26+)
  @available(iOS 26.0, *)
  private func transcribeAudioWithAnalyzer(url: URL) async throws -> String {
    print("[transcribeAudioWithAnalyzer:internal] Called with URL: \(url.path)")
    
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw NSError(domain: "ExpoSpeechTranscriber", code: 404,
                   userInfo: [NSLocalizedDescriptionKey: "Audio file not found at \(url.path)"])
    }
    
    let locale = Locale(identifier: "en_US")
    print("[transcribeAudioWithAnalyzer:internal] Using locale: \(locale.identifier)")
    
    guard await isLocaleSupported(locale: locale) else {
      throw NSError(domain: "ExpoSpeechTranscriber", code: 400,
                   userInfo: [NSLocalizedDescriptionKey: "English locale not supported"])
    }
    
    print("[transcribeAudioWithAnalyzer:internal] Creating transcriber")
    let transcriber = SpeechTranscriber(
      locale: locale,
      transcriptionOptions: [],
      reportingOptions: [.volatileResults],
      attributeOptions: [.audioTimeRange]
    )
    
    print("[transcribeAudioWithAnalyzer:internal] Ensuring model is downloaded")
    try await ensureModel(transcriber: transcriber, locale: locale)
    
    print("[transcribeAudioWithAnalyzer:internal] Creating analyzer")
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    
    print("[transcribeAudioWithAnalyzer:internal] Analyzing audio file")
    let audioFile = try AVAudioFile(forReading: url)
    if let lastSample = try await analyzer.analyzeSequence(from: audioFile) {
      try await analyzer.finalizeAndFinish(through: lastSample)
    } else {
      await analyzer.cancelAndFinishNow()
    }
    
    print("[transcribeAudioWithAnalyzer:internal] Collecting results")
    var finalText = ""
    for try await recResponse in transcriber.results {
      if recResponse.isFinal {
        finalText += String(recResponse.text.characters)
      }
    }
    
    let result = finalText.isEmpty ? "No speech detected" : finalText
    print("[transcribeAudioWithAnalyzer:internal] Final result: \(result)")
    return result
  }
  
  @available(iOS 26.0, *)
  private func isLocaleSupported(locale: Locale) async -> Bool {
    guard SpeechTranscriber.isAvailable else { return false }
    let supported = await DictationTranscriber.supportedLocales
    return supported.map { $0.identifier(.bcp47) }.contains(locale.identifier(.bcp47))
  }
  
  @available(iOS 26.0, *)
  private func isLocaleInstalled(locale: Locale) async -> Bool {
    let installed = await Set(SpeechTranscriber.installedLocales)
    return installed.map { $0.identifier(.bcp47) }.contains(locale.identifier(.bcp47))
  }
  
  @available(iOS 26.0, *)
  private func ensureModel(transcriber: SpeechTranscriber, locale: Locale) async throws {
    guard await isLocaleSupported(locale: locale) else {
      throw NSError(domain: "ExpoSpeechTranscriber", code: 400,
                   userInfo: [NSLocalizedDescriptionKey: "Locale not supported"])
    }
    
    if await isLocaleInstalled(locale: locale) {
      print("[ensureModel] Model already installed")
      return
    } else {
      print("[ensureModel] Downloading model...")
      try await downloadModelIfNeeded(for: transcriber)
    }
  }
  
  @available(iOS 26.0, *)
  private func downloadModelIfNeeded(for module: SpeechTranscriber) async throws {
    if let downloader = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
      try await downloader.downloadAndInstall()
      print("[downloadModelIfNeeded] Model downloaded")
    }
  }
  
  private func requestTranscribePermissions() async -> String {
    print("[requestTranscribePermissions] Requesting permissions")
    return await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { authStatus in
        let result: String
        switch authStatus {
        case .authorized:
          result = "authorized"
        case .denied:
          result = "denied"
        case .restricted:
          result = "restricted"
        case .notDetermined:
          result = "notDetermined"
        @unknown default:
          result = "unknown"
        }
        print("[requestTranscribePermissions] Permission status: \(result)")
        continuation.resume(returning: result)
      }
    }
  }
}