#!/usr/bin/env bash
# Build from any working directory. Activate Emscripten 4.0.18 first.
set -euo pipefail
cd "$(dirname "$0")"
export LC_ALL=C
EMCC="${EMCC:-emcc}"
version="$("$EMCC" --version)"
case "$version" in
  *' 4.0.18 ('*) ;;
  *) printf '%s\n' 'error: Emscripten 4.0.18 is required.' >&2; exit 1 ;;
esac
[[ -s assets/doom1.wad ]] || { echo 'error: assets/doom1.wad is missing' >&2; exit 1; }
mkdir -p build dist
# Remove stale deliverables before compiling; failed builds must not look usable.
rm -f dist/index.html dist/doom.js dist/doom.wasm dist/doom.data

# The sound-enabled engine includes SDL_mixer.h but uses no SDL mixer API.
# Keep this compatibility shim generated, without changing supplied sources.
mkdir -p build/audio-include
printf '%s\n' '/* WebAudio backend: no SDL mixer API required. */' > build/audio-include/SDL_mixer.h

# Supplied engine only. icon.c is include data, not a translation unit.
# ORIGCODE and STANDALONE are intentionally not defined.
engine=(
  am_map d_event d_items d_iwad d_loop d_main d_mode d_net
  doomdef doomgeneric doomstat dstrings dummy f_finale f_wipe g_game
  gusconf hu_lib hu_stuff i_cdmus i_endoom i_input i_joystick i_scale
  i_sound i_system i_timer i_video info m_argv m_bbox m_cheat m_config
  m_controls m_fixed m_menu m_misc m_random memio mus2mid
  p_ceilng p_doors p_enemy p_floor p_inter p_lights p_map p_maputl
  p_mobj p_plats p_pspr p_saveg p_setup p_sight p_spec p_switch
  p_telept p_tick p_user r_bsp r_data r_draw r_main r_plane r_segs
  r_sky r_things s_sound sha1 sounds st_lib st_stuff statdump tables
  v_video w_checksum w_file w_file_stdc w_main w_wad wi_stuff z_zone
)
sources=()
for name in "${engine[@]}"; do
  sources+=("third_party/doomgeneric/$name.c")
done
# Each platform translation unit is compiled exactly once. Runtime coder supplies
# main() in platform/doomgeneric_runtime.c; video/input owns doomgeneric_wasm.c.
sources+=(platform/*.c)
"$EMCC" "${sources[@]}" -Ithird_party/doomgeneric \
  -DFEATURE_SOUND -Ibuild/audio-include \
  -O2 -g2 -std=gnu11 -Werror=implicit-function-declaration \
  -sASSERTIONS=1 -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=1048576 \
  -sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=131072 \
  -sFORCE_FILESYSTEM=1 -sENVIRONMENT=web -sEXIT_RUNTIME=0 \
  -sEXPORTED_FUNCTIONS='["_main"]' \
  -sEXPORTED_RUNTIME_METHODS='["callMain","FS"]' \
  --preload-file assets/doom1.wad@/doom1.wad \
  -lm -o dist/doom.js
cp web/index.html dist/index.html
printf '%s\n' 'Built dist/index.html, dist/doom.js, dist/doom.wasm, dist/doom.data'
