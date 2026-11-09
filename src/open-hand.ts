import type { Object3D, WebXRManager } from '@iwsdk/core';
import { Quaternion, Vector3 } from '@iwsdk/core';
import { HandReader } from './hand-joints.js';

/**
 * Open-hand test: the hand pushed forward and raised, palm facing away, and
 * the index, middle and ring fingers straight (tip-to-knuckle distance close
 * to the finger's length, which a relaxed or curled hand fails).
 */
const HAND_RAISED = 0.45;
const HAND_FORWARD = 0.28;
const PALM_FORWARD = 0.4;
const STRAIGHT = 0.9;

const FINGERS = ['index', 'middle', 'ring'] as const;
type Finger = (typeof FINGERS)[number];
/** Joint names of each finger, knuckle to tip (WebXR Hand Input names). */
const BONES: Record<Finger, readonly XRHandJoint[]> = {
  index: ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
  middle: ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
  ring: ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
};

/**
 * The universal "not now" / "stop": a tracked hand held up in front, open,
 * palm facing away, read from the WebXR hand joints. Used to decline a
 * breathing break and to open closed eyes at once.
 */
export class OpenHandDetector {
  private hands: HandReader;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private v = new Vector3();
  private wrist = new Vector3();
  private n = new Vector3();
  private a = new Vector3();
  private b = new Vector3();
  private j0 = new Vector3();
  private j1 = new Vector3();

  constructor(
    xr: WebXRManager,
    player: Object3D,
    private headObject: Object3D,
    /** Whether the player uses this hand (one-hand mode ignores the other). */
    private usesHand: (side: 'left' | 'right') => boolean = () => true,
  ) {
    this.hands = new HandReader(xr, player);
  }

  /** True when an open hand is shown now. */
  shown(): boolean {
    const hands = this.hands;
    if (!hands.begin() || !hands.sources) return false;
    this.headObject.getWorldPosition(this.head);
    this.headObject.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    const sources = hands.sources;
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const hand = source.hand;
      if (!hand || source.handedness === 'none') continue;
      if (!this.usesHand(source.handedness)) continue;
      if (!hands.joint(hand, 'wrist', this.wrist)) continue;
      // Raised, and pushed out in front of the body.
      if (this.wrist.y < this.head.y - HAND_RAISED) continue;
      this.v.subVectors(this.wrist, this.head);
      this.v.y = 0;
      if (this.v.dot(this.forward) < HAND_FORWARD) continue;
      // Palm facing away: the normal of the knuckle triangle points forward.
      if (!hands.joint(hand, 'index-finger-metacarpal', this.a)) continue;
      if (!hands.joint(hand, 'pinky-finger-metacarpal', this.b)) continue;
      this.a.sub(this.wrist);
      this.b.sub(this.wrist);
      if (source.handedness === 'right') this.n.crossVectors(this.a, this.b);
      else this.n.crossVectors(this.b, this.a);
      if (this.n.normalize().dot(this.forward) < PALM_FORWARD) continue;
      if (this.fingersStraight(hand)) return true;
    }
    return false;
  }

  /** Index, middle and ring each nearly straight from knuckle to tip. */
  private fingersStraight(hand: XRHand): boolean {
    for (const finger of FINGERS) {
      const bones = BONES[finger];
      let length = 0;
      if (!this.hands.joint(hand, bones[0], this.j0)) return false;
      this.a.copy(this.j0);
      for (let i = 1; i < bones.length; i++) {
        if (!this.hands.joint(hand, bones[i], this.j1)) return false;
        length += this.j1.distanceTo(this.j0);
        this.j0.copy(this.j1);
      }
      if (length <= 0 || this.j1.distanceTo(this.a) / length < STRAIGHT) return false;
    }
    return true;
  }
}
