#ifndef PLATFORM_AUDIO_H
#define PLATFORM_AUDIO_H

/* Idempotent: install browser gesture handlers. Also called by sound Init. */
void DG_AudioInit(void);
/* Call synchronously from a trusted key/click handler, not after an await. */
void DG_AudioResume(void);

#endif
