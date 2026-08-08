// WebAudio Audio Processing & WAV Generator Utility for PEWA Voice Notes

export function sliceAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startOffset = Math.floor(Math.max(0, startSec) * sampleRate);
  const endOffset = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const frameCount = Math.max(1, endOffset - startOffset);

  const newBuffer = ctx.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channelData = buffer.getChannelData(c);
    const newChannelData = newBuffer.getChannelData(c);
    for (let i = 0; i < frameCount; i++) {
      newChannelData[i] = channelData[startOffset + i];
    }
  }

  return newBuffer;
}

export async function processAudioWithEffect(buffer: AudioBuffer, effect: string): Promise<AudioBuffer> {
  if (effect === 'normal' || !effect) return buffer;

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  let lastNode: AudioNode = source;

  if (effect === 'deep') {
    source.playbackRate.value = 0.82;
    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 1000;
    lastNode.connect(lowPass);
    lastNode = lowPass;
  } else if (effect === 'soft') {
    const highPass = offlineCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 450;
    const gain = offlineCtx.createGain();
    gain.gain.value = 0.8;
    lastNode.connect(highPass);
    highPass.connect(gain);
    lastNode = gain;
  } else if (effect === 'studio') {
    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    lastNode.connect(comp);
    lastNode = comp;
  } else if (effect === 'echo') {
    const delay = offlineCtx.createDelay();
    delay.delayTime.value = 0.22;
    const feedback = offlineCtx.createGain();
    feedback.gain.value = 0.35;
    lastNode.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(offlineCtx.destination);
  } else if (effect === 'bass_boost') {
    const bass = offlineCtx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 240;
    bass.gain.value = 9;
    lastNode.connect(bass);
    lastNode = bass;
  } else if (effect === 'treble_boost') {
    const treble = offlineCtx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 3400;
    treble.gain.value = 9;
    lastNode.connect(treble);
    lastNode = treble;
  } else if (effect === 'radio') {
    const bandPass = offlineCtx.createBiquadFilter();
    bandPass.type = 'bandpass';
    bandPass.frequency.value = 1400;
    bandPass.Q.value = 2.2;
    lastNode.connect(bandPass);
    lastNode = bandPass;
  }

  lastNode.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      dataView.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  dataView.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, format, true);
  dataView.setUint16(22, numChannels, true);
  dataView.setUint32(24, sampleRate, true);
  dataView.setUint32(28, sampleRate * blockAlign, true);
  dataView.setUint16(32, blockAlign, true);
  dataView.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  dataView.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = buffer.getChannelData(channel)[i];
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      dataView.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
