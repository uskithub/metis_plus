export class MyAudioProcessor extends AudioWorkletProcessor {
  /**
   * @param { Float32Array[][] } inputs
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input && input.length > 0) {
      const monaural_channel = input[0]
      this.port.postMessage(monaural_channel)
    }
    return true
  }
}

registerProcessor("myAudioProcessor", MyAudioProcessor)
