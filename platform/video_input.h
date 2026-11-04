#ifndef PLATFORM_VIDEO_INPUT_H
#define PLATFORM_VIDEO_INPUT_H

/* Canvas 2D and keyboard backend. Uses Module.canvas (#canvas fallback).
 * Controls: W/S forward/back, A/D strafe, Left/Right turn, Space fire,
 * E use, Shift run; Up/Down/Enter/Escape menus, Tab map, digits weapons,
 * F1-F12 engine shortcuts. Letters remain ordinary save-name characters.
 * Click canvas to focus; blur/hidden document releases all held keys.
 * Runtime owns main, DG_SleepMs and DG_GetTicksMs. No exported JS API needed.
 */
void DG_Init(void);
void DG_DrawFrame(void);
int DG_GetKey(int *pressed, unsigned char *key);
void DG_SetWindowTitle(const char *title);

#endif
