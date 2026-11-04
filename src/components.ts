import { defineComponents } from '@iwsdk/core';
import {
  Bonsai,
  FireflyGuide,
  PruningShears,
  ReturnHome,
  Seed,
  WateringCan,
} from './garden-components.js';

export default defineComponents([Bonsai, WateringCan, PruningShears, ReturnHome, Seed, FireflyGuide]);
