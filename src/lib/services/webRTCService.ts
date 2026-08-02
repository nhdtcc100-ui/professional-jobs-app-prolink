import Peer, { MediaConnection } from 'peerjs';

export class WebRTCService {
  private peer: Peer | null = null;
  private currentCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;

  constructor(userId: string) {
    // High-performance ICE configuration with redundant STUN/TURN servers
    // Generate a session-specific ID to avoid "ID taken" errors on refresh
    const sessionSuffix = Math.random().toString(36).substring(2, 6);
    const peerId = `${userId}-${sessionSuffix}`;

    this.peer = new Peer(peerId, {
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.apple.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          { 
            urls: 'turn:openrelay.metered.ca:80', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
          },
          { 
            urls: 'turn:openrelay.metered.ca:443', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
          },
          { 
            urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
          }
        ],
        sdpSemantics: 'unified-plan',
        iceCandidatePoolSize: 10
      }
    });

    this.peer.on('open', (id) => {
      console.log('DEBUG: WebRTC Peer Connection Opened with ID:', id);
      // Store the actual peer ID globally
      (window as any).currentPeerId = id;
      
      // Update the profile in Supabase so others can find this user
      import('./profileService').then(({ profileService }) => {
        profileService.updateProfile(userId, { 
          current_peer_id: id,
          last_seen_at: new Date().toISOString()
        }).catch(err => console.error("DEBUG: Failed to sync Peer ID to profile:", err));
      });
    });

    this.peer.on('disconnected', () => {
      console.log('DEBUG: Peer disconnected, attempting to reconnect...');
      this.peer?.reconnect();
    });

    this.peer.on('error', (err: any) => {
      console.error('DEBUG: WebRTC Peer Error:', err.type, err);
      if (err.type === 'unavailable-id') {
        console.warn("DEBUG: ID taken, this is expected if multiple tabs are open.");
      }
    });
  }

  // Proactively request permissions for mobile
  async requestPermissions(): Promise<{ video: boolean; audio: boolean; error: string | null }> {
    try {
      console.log("DEBUG: Proactively requesting media permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop tracks immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      return { video: true, audio: true, error: null };
    } catch (err: any) {
      console.error("DEBUG: Permission request failed:", err);
      return { 
        video: false, 
        audio: false, 
        error: err.name === 'NotAllowedError' ? 'تم رفض الإذن. يرجى تفعيله من إعدادات الموبايل.' : err.message 
      };
    }
  }

  // Get local media stream (Camera & Mic)
  async getLocalStream(video: boolean = true): Promise<MediaStream | null> {
    try {
      if (this.localStream) return this.localStream;
      
      const constraints = {
        video: video ? { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (videoErr) {
        console.warn('DEBUG: Failed to get video, falling back to audio only:', videoErr);
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: constraints.audio
        });
      }
      return this.localStream;
    } catch (err) {
      console.error('DEBUG: Failed to get local stream (even audio):', err);
      return null;
    }
  }

  // Start an outgoing call with retry logic
  async callUser(targetUserId: string, onRemoteStream: (stream: MediaStream) => void, retries: number = 3): Promise<MediaConnection | null> {
    const stream = await this.getLocalStream();
    if (!stream || !this.peer || this.peer.destroyed) return null;

    // Ensure peer is open before calling
    if (!this.peer.open) {
      console.log("DEBUG: Peer not open, waiting for open event...");
      await new Promise((resolve) => {
        this.peer?.once('open', resolve);
        setTimeout(resolve, 5000); // Timeout after 5s
      });
    }

    let attempt = 0;
    while (attempt < retries) {
      console.log(`DEBUG: Initiating PeerJS call (Attempt ${attempt + 1}/${retries}) to:`, targetUserId);
      const call = this.peer.call(targetUserId, stream);
      
        if (call) {
          call.on('stream', (remoteStream) => {
            console.log("DEBUG: Received Remote Stream (Outgoing). Tracks:", remoteStream.getTracks().map(t => t.kind));
            const audioTracks = remoteStream.getAudioTracks();
            console.log("DEBUG: Audio tracks found:", audioTracks.length, audioTracks[0]?.enabled);
            onRemoteStream(remoteStream);
          });
          
          call.on('close', () => {
            console.log("DEBUG: PeerJS Call Closed (Outgoing)");
            this.endCall();
            if ((window as any).onCallClosed) (window as any).onCallClosed();
          });

          call.on('error', (err) => {
            console.error("DEBUG: Call Error:", err);
          });

          this.currentCall = call;
          return call;
        }

      attempt++;
      if (attempt < retries) {
        console.warn("DEBUG: Call failed, retrying in 2 seconds...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.error("DEBUG: Failed to connect to peer after all retries.");
    return null;
  }

  // Answer an incoming call
  async answerCall(call: MediaConnection, onRemoteStream: (stream: MediaStream) => void) {
    const stream = await this.getLocalStream();
    if (!stream) return;

    console.log("DEBUG: Answering PeerJS call...");
    call.answer(stream);
    
    call.on('stream', (remoteStream) => {
      console.log("DEBUG: Received Remote Stream (Incoming). Tracks:", remoteStream.getTracks().map(t => t.kind));
      onRemoteStream(remoteStream);
    });

    call.on('close', () => {
      console.log("DEBUG: PeerJS Call Closed (Incoming)");
      this.endCall();
      if ((window as any).onCallClosed) (window as any).onCallClosed();
    });

    this.currentCall = call;
  }

  // Listen for incoming PeerJS calls
  onIncomingCall(callback: (call: MediaConnection) => void) {
    if (!this.peer) return;
    this.peer.on('call', (call) => {
      console.log("DEBUG: PeerJS Incoming Call Detected!");
      callback(call);
    });
  }

  // End and cleanup
  endCall() {
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  destroy() {
    this.endCall();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export const webRTCManager = (userId: string) => new WebRTCService(userId);
