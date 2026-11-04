#ifndef PLATFORM_AUDIO_H
#define PLATFORM_AUDIO_H

/* Music is supplied through DG_music_module (MUS -> synthesized WebAudio
 * buffers, synthesized off-thread in an embedded Blob Web Worker). No additional
 * runtime calls or build dependencies are required. Browser CSP must permit
 * worker-src blob:. Replacing/stopping a score cancels pending synthesis.
 * Effects and music share the gesture-unlocked AudioContext. */

/* Idempotent: install browser gesture handlers. Also called by sound Init. */
void DG_AudioInit(void);
/* Call synchronously from a trusted key/click handler, not after an await. */
void DG_AudioResume(void);

#endif
