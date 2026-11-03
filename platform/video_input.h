#ifndef PLATFORM_VIDEO_INPUT_H
#define PLATFORM_VIDEO_INPUT_H

/* Canvas 2D and keyboard backend. Uses Module.canvas (#canvas fallback).
 * Controls: arrows move/turn, Ctrl fire, Space use, Shift run, Alt strafe;
 * Enter/Escape menus, Tab map, digits weapons, F1-F12 engine shortcuts.
 * Click canvas to focus; blur/hidden document releases all held keys.
 * Runtime owns main, DG_SleepMs and DG_GetTicksMs. No exported JS API needed.
 */
void DG_Init(void);
void DG_DrawFrame(void);
int DG_GetKey(int *pressed, unsigned char *key);
void DG_SetWindowTitle(const char *title);

#endif
