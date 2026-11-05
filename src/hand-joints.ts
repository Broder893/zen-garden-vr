import type { Object3D, Vector3, WebXRManager } from '@iwsdk/core';

/** WebXR Hand Input's batched pose read (missing from the bundled XRFrame typings). */
type FillPoses = (spaces: XRSpace[], base: XRSpace, transforms: Float32Array) => boolean;

/**
 * Reads WebXR hand joints in world space, for gestures IWSDK does not provide
 * (an open hand, fingertips touching the sand). Call begin() once per frame,
 * then fill() for joints read every frame (no allocation) or joint() for
 * occasional single reads.
 */
export class HandReader {
  frame: XRFrame | null = null;
  private ref: XRReferenceSpace | null = null;
  sources: XRInputSourceArray | null = null;
  /** Joint spaces per hand and per name list, looked up once. */
  private spaces = new WeakMap<XRHand, Map<readonly XRHandJoint[], XRJointSpace[]>>();

  constructor(
    private xr: WebXRManager,
    /** The player rig: joint poses are in the XR reference space, its local frame. */
    private player: Object3D,
  ) {}

  /** Prepares this frame's reads; false outside an immersive session or without hand poses. */
  begin(): boolean {
    this.frame = this.xr.getFrame() ?? null;
    this.ref = this.xr.getReferenceSpace();
    this.sources = this.xr.getSession()?.inputSources ?? null;
    return !!(this.frame && this.ref && this.sources && this.frame.getJointPose);
  }

  /**
   * Reads several joints at once (frame.fillPoses, no per-joint allocation)
   * into `out`, one 4x4 matrix per joint; then position(i, out) gives each.
   */
  fill(hand: XRHand, names: readonly XRHandJoint[], out: Float32Array): boolean {
    const fillPoses = (this.frame as (XRFrame & { fillPoses?: FillPoses }) | null)?.fillPoses;
    if (!fillPoses || !this.frame || !this.ref) return false;
    let byList = this.spaces.get(hand);
    if (!byList) this.spaces.set(hand, (byList = new Map()));
    let spaces = byList.get(names);
    if (!spaces) {
      const list: XRJointSpace[] = [];
      for (const n of names) {
        const s = hand.get(n);
        if (!s) return false;
        list.push(s);
      }
      byList.set(names, (spaces = list));
    }
    return fillPoses.call(this.frame, spaces, this.ref, out);
  }

  /** World position of joint `i` from a fill() result. */
  position(i: number, matrices: Float32Array, out: Vector3): Vector3 {
    out.set(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14]);
    return this.player.localToWorld(out);
  }

  /** Writes a joint's world position into `out`; false when it is not tracked. */
  joint(hand: XRHand, name: XRHandJoint, out: Vector3): boolean {
    const space = hand.get(name);
    if (!space || !this.frame || !this.ref) return false;
    const pose = this.frame.getJointPose?.(space, this.ref);
    if (!pose) return false;
    const p = pose.transform.position;
    out.set(p.x, p.y, p.z);
    this.player.localToWorld(out);
    return true;
  }
}
