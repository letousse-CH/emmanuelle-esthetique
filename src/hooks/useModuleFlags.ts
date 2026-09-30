"use client";

import { useSettings } from './useSettings';
import { MODULE_SETTING_KEYS, ModuleFlags, toModuleFlags } from '../config/moduleFlags';

export function useModuleFlags(): ModuleFlags {
  const values = useSettings(Object.values(MODULE_SETTING_KEYS));
  return toModuleFlags(values);
}
