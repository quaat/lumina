import { MidiOutputDevice } from '../types';

export class WebMidiService {
  private access: MIDIAccess | null = null;
  private outputs: Map<string, MIDIOutput> = new Map();

  async initialize(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API is not supported in this browser.');
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.updateOutputs();
      this.access.onstatechange = () => {
        this.updateOutputs();
      };
    } catch (err) {
      console.error('MIDI Access Failed', err);
      throw err;
    }
  }

  private updateOutputs() {
    this.outputs.clear();
    if (this.access) {
      this.access.outputs.forEach((output) => {
        this.outputs.set(output.id, output);
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

  sendNoteOn(deviceId: string, channel: number, note: number, velocity: number, timestamp?: number) {
    const output = this.outputs.get(deviceId);
    if (!output) return;

    // MIDI Note On: 0x90 + channel (0-15)
    // Velocity is 0-127. If velocity is 0-1, it's effectively note off on some synths, but standard is >0
    const status = 0x90 + (Math.max(0, Math.min(15, channel - 1)));
    const data = [status, Math.floor(note), Math.floor(velocity * 127)];
    
    // timestamp is DOMHighResTimeStamp (performance.now())
    output.send(data, timestamp);
  }

  sendNoteOff(deviceId: string, channel: number, note: number, timestamp?: number) {
    const output = this.outputs.get(deviceId);
    if (!output) return;

    // MIDI Note Off: 0x80 + channel
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
      // All Notes Off (CC 123)
      output.send([0xB0 + ch, 123, 0]);
      // All Sound Off (CC 120) - harder reset
      output.send([0xB0 + ch, 120, 0]);
    });
  }
}

export const webMidiService = new WebMidiService();