/* Development harness: link the unmodified supplied engine input units.
 * Only unrelated UI responders/chat are stubbed; keyboard state, defaults,
 * translation, event queue, and tic-command generation are engine code.
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "doomdef.h"
#include "doomkeys.h"
#include "doomstat.h"
#include "d_event.h"
#include "g_game.h"
#include "m_controls.h"

extern gameaction_t gameaction;
void I_GetEvent(void);
/* Runtime globals outside the input units; neutral test environment. */
int mouseSensitivity = 5;
int ticdup = 1;
static int pending, down, code;
int DG_GetKey(int *pressed, unsigned char *key) {
    if (!pending) return 0;
    pending = 0;
    *pressed = down;
    *key = code;
    return 1;
}
boolean HU_Responder(event_t *ev) { (void) ev; return false; }
boolean ST_Responder(event_t *ev) { (void) ev; return false; }
boolean AM_Responder(event_t *ev) { (void) ev; return false; }
boolean F_Responder(event_t *ev) { (void) ev; return false; }
void M_StartControlPanel(void) { assert(!"unexpected menu"); }
char HU_dequeueChatChar(void) { return 0; }

int main(int argc, char **argv) {
    if (argc == 2 && strcmp(argv[1], "--constants") == 0) {
        printf("{\"fire\":%d,\"use\":%d,\"attack\":%d,\"use_button\":%d,"
               "\"up\":%d,\"left\":%d,\"shift\":%d}\n",
               KEY_FIRE, KEY_USE, BT_ATTACK, BT_USE,
               KEY_UPARROW, KEY_LEFTARROW, KEY_RSHIFT);
        return 0;
    }
    assert(key_fire == KEY_FIRE && key_use == KEY_USE);
    gamestate = GS_LEVEL;
    gameaction = ga_nothing;
    int expected, step = 0;
    while (scanf("%d %d %d", &down, &code, &expected) == 3) {
        /* -1 is a checkpoint with no queued event (e.g. an alias held). */
        pending = down >= 0;
        I_GetEvent();
        event_t *event;
        while ((event = D_PopEvent()) != NULL) G_Responder(event);
        ticcmd_t cmd;
        G_BuildTiccmd(&cmd, 0);
        int actual = cmd.buttons & (BT_ATTACK | BT_USE);
        if (actual != expected) {
            fprintf(stderr, "step %d: down=%d key=%d buttons=%d expected=%d\n",
                    step, down, code, actual, expected);
            return 1;
        }
        ++step;
    }
    assert(step > 0);
    printf("PASS: %d real engine input/action checkpoints\n", step);
    return 0;
}
