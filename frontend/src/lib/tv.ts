import { createTV } from "tailwind-variants"

import { twMergeConfig } from "@/lib/utils"

/**
 * The Koala UI variant engine: an instance of `tailwind-variants` wired to the same
 * `tailwind-merge` config as `cn`, so custom token scales resolve consistently.
 *
 * Always import `tv` from here, never from "tailwind-variants" directly.
 * Use `slots` for multi-part components; a flat recipe for single-element ones.
 */
export const tv = createTV({ twMergeConfig })

export type { VariantProps } from "tailwind-variants"
