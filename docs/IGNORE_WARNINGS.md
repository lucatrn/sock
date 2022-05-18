
This document lists warnings in build/browser that can be safely ignored.

## WebGL|Firefox: `Tex image TEXTURE_2D level 0 is incurring lazy initialization`

The work needed to hide this warning is less performant than the work Firefox is complaining about.
See `gman`'s thorough comment on this: https://stackoverflow.com/a/57734917.
