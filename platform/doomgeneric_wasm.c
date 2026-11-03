/* Platform callbacks are implemented in video_input.c (video/input/title)
 * and doomgeneric_runtime.c (main/clock/cooperative sleep). This original
 * placeholder intentionally defines no callbacks, avoiding duplicate symbols
 * when the build includes all platform C translation units.
 */
#include "doomgeneric.h"
