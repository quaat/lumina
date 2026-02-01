import { MidiOutputDevice, MidiInputDevice } from '../types';

type MidiMessageCallback = (message: MIDIMessageEvent) => void;

export class WebMidiService {
  private access: MIDIAccess | null = null;
  private outputs: Map<string, MIDIOutput> = new Map();
  private inputs: Map<string, MIDIInput> = new Map();
  private messageListeners: Set<MidiMessageCallback> = new Set();
  private activeInputId: string | null = null;

  async initialize(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API is not supported in this browser.');
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.updatePorts();
      this.access.onstatechange = () => {
        this.updatePorts();
      };
    } catch (err) {
      console.error('MIDI Access Failed', err);
      throw err;
    }
  }

  private updatePorts() {
    this.outputs.clear();
    this.inputs.clear();
    if (this.access) {
      this.access.outputs.forEach((output) => {
        this.outputs.set(output.id, output);
      });
      this.access.inputs.forEach((input) => {
        this.inputs.set(input.id, input);
        // If this input was already active, re-attach listener
        if (input.id === this.activeInputId) {
          input.onmidimessage = this.handleMidiMessage.bind(this);
        }
      });
    }
  }

  getOutputs(): MidiOutputDevice[] {
    const devices: MidiOutputDevice[] = [];
    this.outputs.forEach((output) => {
      devices.push({
        id: output.id,
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer,
      });
    });
    return devices;
  }

  getInputs(): MidiInputDevice[] {
    const devices: MidiInputDevice[] = [];
    this.inputs.forEach((input) => {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer,
      });
    });
    return devices;
  }

  setInput(deviceId: string | null) {
    // Cleanup old input
    if (this.activeInputId) {
      const oldInput = this.inputs.get(this.activeInputId);
      if (oldInput) oldInput.onmidimessage = null;
    }

    this.activeInputId = deviceId;

    if (deviceId) {
      const newInput = this.inputs.get(deviceId);
      if (newInput) {
        newInput.onmidimessage = this.handleMidiMessage.bind(this);
      }
    }
  }

  addMessageListener(callback: MidiMessageCallback) {
    this.messageListeners.add(callback);
  }

  removeMessageListener(callback: MidiMessageCallback) {
    this.messageListeners.delete(callback);
  }

  private handleMidiMessage(event: MIDIMessageEvent) {
    this.messageListeners.forEach(listener => listener(event));
  }

  sendNoteOn(deviceId: string, channel: number, note: number, velocity: number, timestamp?: number) {
    const output = this.outputs.get(deviceId);
    if (!output) return;

    const status = 0x90 + (Math.max(0, Math.min(15, channel - 1)));
    const data = [status, Math.floor(note), Math.floor(velocity * 127)];
    
    output.send(data, timestamp);
  }

  sendNoteOff(deviceId: string, channel: number, note: number, timestamp?: number) {
    const output = this.outputs.get(deviceId);
    if (!output) return;

    const status = 0x80 + (Math.max(0, Math.min(15, channel - 1)));
    const data = [status, Math.floor(note), 0];
    
    output.send(data, timestamp);
  }

  panic(deviceId: string, channel?: number | 'original') {
    const output = this.outputs.get(deviceId);
    if (!output) return;

    const channelsToSend = channel === 'original' 
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] 
      : [Math.max(0, Math.min(15, (channel as number) - 1))];

    channelsToSend.forEach(ch => {
      output.send([0xB0 + ch, 123, 0]);
      output.send([0xB0 + ch, 120, 0]);
    });
  }
}

export const webMidiService = new WebMidiService();
